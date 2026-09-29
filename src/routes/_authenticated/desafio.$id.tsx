import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Upload, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MediaGallery } from "@/components/MediaGallery";
import { cn } from "@/lib/utils";
import bgAsset from "@/assets/montanhas.jpg.asset.json";
import {
  countdown,
  formatDateTime,
  liveState,
  stateClass,
  stateLabel,
  submissionLabel,
  type Challenge,
  type Submission,
} from "@/lib/game";

export const Route = createFileRoute("/_authenticated/desafio/$id")({
  head: () => ({
    meta: [
      { title: "Desafio — CJAS Belém Game" },
      { name: "description", content: "Veja as instruções do desafio e envie sua foto ou vídeo de comprovação." },
      { property: "og:title", content: "Desafio — CJAS Belém Game" },
      { property: "og:description", content: "Instruções do desafio e envio de comprovação." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChallengeDetail,
});

interface FileRow {
  id: string;
  storage_path: string;
  file_type: string;
  submission_id: string;
}

function ChallengeDetail() {
  const { id } = Route.useParams();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: challenge, isPending: challengePending, isError: challengeError } = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Challenge | null;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_settings").select("finished").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: submission } = useQuery({
    queryKey: ["submission", id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("challenge_id", id)
        .eq("user_id", userId!)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Submission | null;
    },
  });

  const { data: myFiles = [], isPending: filesPending } = useQuery({
    queryKey: ["submission-files", submission?.id],
    enabled: !!submission?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission_files")
        .select("id,storage_path,file_type,submission_id")
        .eq("submission_id", submission!.id);
      if (error) throw error;
      return (data ?? []) as FileRow[];
    },
  });

  const state = challenge ? liveState(challenge, new Date(now)) : "agendado";
  const status = submissionLabel(submission?.status);
  const canSubmit =
    !!challenge && !settings?.finished &&
    state === "ativo" &&
    (!submission || (submission.status === "rejected" && challenge.allow_resubmit) || (submission.status === "submitted" && !filesPending && myFiles.length === 0));

  const upload = useMutation({
    mutationFn: async () => {
      if (!challenge || !userId) throw new Error("Sessão inválida");
      if (!canSubmit) throw new Error("O desafio não está aberto para envios.");
      if (files.length === 0) throw new Error("Selecione ao menos um arquivo.");
      if (challenge.requires_photo && !files.some((f) => f.type.startsWith("image/"))) throw new Error("Inclua uma foto para este desafio.");
      if (challenge.requires_video && !files.some((f) => f.type.startsWith("video/"))) throw new Error("Inclua um vídeo para este desafio.");
      let subId = submission?.id;
      const isRetry = submission?.status === "rejected";
      if (!subId) {
        const { data: sub, error: subError } = await supabase
          .from("submissions")
          .insert({ challenge_id: challenge.id, user_id: userId })
          .select("id")
          .single();
        if (subError) throw subError;
        subId = sub.id;
      }

      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${userId}/${subId}/${crypto.randomUUID()}.${ext}`;
        const { error: upError } = await supabase.storage.from("proofs").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upError) throw upError;
        const { error: rowError } = await supabase.from("submission_files").insert({
          submission_id: subId,
          user_id: userId,
          storage_path: path,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
        });
        if (rowError) throw rowError;
      }
      if (isRetry && subId) {
        const { error } = await supabase.rpc("resubmit_proof", { _submission_id: subId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Envio recebido! Aguarde a validação da organização.");
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["submission", id, userId] });
      queryClient.invalidateQueries({ queryKey: ["submission-files"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível enviar."),
  });

  if (challengePending) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando desafio…</p>;
  if (challengeError || !challenge) return <p className="py-10 text-center text-sm text-muted-foreground">Desafio indisponível.</p>;

  const maxBytes = 100 * 1024 * 1024;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
        <Link to="/dashboard">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </Button>

      <section className="animate-rise-in relative isolate overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-lg">
        <img
          src={bgAsset.url}
          fetchPriority="high"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/95 via-primary/80 to-background/65" />
        <div className="flex flex-wrap items-center gap-2">
          {challenge.type === "relampago" && (
            <Badge className="gap-1 bg-warning text-warning-foreground">
              <Zap className="size-3" /> Relâmpago
            </Badge>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", stateClass[state])}>
            {stateLabel[state]}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>
            {status.text}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{challenge.title}</h1>
        <p className="text-sm text-primary-foreground/80">{challenge.description}</p>
        <p className="text-sm">
          <span className="font-semibold">+{challenge.points} pontos</span> · {formatDateTime(challenge.starts_at)} até{" "}
          {formatDateTime(challenge.ends_at)}
        </p>
        {state === "ativo" && (
          <p className="text-sm font-semibold text-primary-foreground">Tempo restante: <TimeRemaining at={challenge.ends_at} /></p>
        )}
      </section>

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <h2 className="font-semibold">Como participar</h2>
          <p className="whitespace-pre-wrap text-muted-foreground">{challenge.instructions}</p>
          {challenge.extra_rules && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">Regras: {challenge.extra_rules}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Comprovação: {challenge.requires_photo ? "foto" : ""}
            {challenge.requires_photo && challenge.requires_video ? " e " : ""}
            {challenge.requires_video ? "vídeo" : ""} · até 100 MB por arquivo
          </p>
        </CardContent>
      </Card>

      {submission && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Seu envio</h2>
            <p className="text-xs text-muted-foreground">Enviado em {formatDateTime(submission.submitted_at)}</p>
            {submission.status === "rejected" && submission.rejection_reason && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Motivo: {submission.rejection_reason}
              </p>
            )}
            <MediaGallery files={myFiles} />
          </CardContent>
        </Card>
      )}

      {canSubmit ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Enviar comprovação</h2>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                const tooBig = picked.find((f) => f.size > maxBytes);
                if (tooBig) {
                  toast.error("Cada arquivo pode ter no máximo 100 MB.");
                  return;
                }
                setFiles(picked);
              }}
            />
            <Button variant="outline" className="w-full gap-2" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
              <Upload className="size-4" /> Escolher foto ou vídeo
            </Button>
            {files.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {files.map((f) => (
                  <li key={f.name}>
                    {f.name} · {(f.size / 1024 / 1024).toFixed(1)} MB
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="w-full"
              disabled={upload.isPending || files.length === 0}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? "Enviando…" : "Enviar para validação"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
           {settings?.finished ? "O evento foi encerrado para novos envios."
             : state !== "ativo"
            ? "Este desafio não está aberto para envios."
            : submission?.status === "confirmed"
              ? "Sua participação já foi confirmada."
              : submission?.status === "submitted"
                ? "Seu envio está em análise pela organização."
                : "Reenvio não permitido para este desafio."}
        </p>
      )}
    </div>
  );
}

function TimeRemaining({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>{countdown(at, now)}</span>;
}
