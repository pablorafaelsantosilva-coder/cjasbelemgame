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
import { Switch } from "@/components/ui/switch";
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
      {
        name: "description",
        content: "Veja as instruções do desafio e envie sua foto ou vídeo de comprovação.",
      },
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
  const [shareInChat, setShareInChat] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const {
    data: challenge,
    isPending: challengePending,
    isError: challengeError,
  } = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Challenge | null;
    },
  });

  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("finished,max_file_mb")
        .eq("id", 1)
        .single();
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
    !!challenge &&
    !!settings &&
    !settings.finished &&
    state === "ativo" &&
    (!submission ||
      (submission.status === "rejected" && challenge.allow_resubmit) ||
      (submission.status === "submitted" && !filesPending && myFiles.length === 0));
  const maxFileMb = settings?.max_file_mb ?? 50;
  const maxBytes = maxFileMb * 1024 * 1024;

  const upload = useMutation({
    mutationFn: async () => {
      if (!challenge || !userId) throw new Error("Sessão inválida");
      if (!canSubmit) throw new Error("O desafio não está aberto para envios.");
      if (files.length === 0) throw new Error("Selecione ao menos um arquivo.");
      if (files.some((file) => file.size > maxBytes))
        throw new Error(`Cada arquivo pode ter no máximo ${maxFileMb} MB.`);
      if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/")))
        throw new Error("Envie apenas fotos ou vídeos.");
      if (challenge.requires_photo && !files.some((f) => f.type.startsWith("image/")))
        throw new Error("Inclua uma foto para este desafio.");
      if (challenge.requires_video && !files.some((f) => f.type.startsWith("video/")))
        throw new Error("Inclua um vídeo para este desafio.");
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

      // Register the complete set together: admins must not see a partial upload.
      const uploadedPaths: string[] = [];
      const fileRows: {
        submission_id: string;
        user_id: string;
        storage_path: string;
        file_type: string;
        file_size: number;
      }[] = [];
      try {
        for (const [index, file] of files.entries()) {
          setUploadStep(`Enviando arquivo ${index + 1} de ${files.length}…`);
          const ext =
            file.name
              .split(".")
              .pop()
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, "") || "bin";
          const path = `${userId}/${subId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("proofs")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (error)
            throw new Error(
              `Falha ao enviar ${file.name}. Confira a conexão e o limite de armazenamento. ${error.message}`,
            );
          uploadedPaths.push(path);
          fileRows.push({
            submission_id: subId!,
            user_id: userId,
            storage_path: path,
            file_type: file.type,
            file_size: file.size,
          });
        }
        setUploadStep("Registrando comprovação…");
        const { error } = await supabase.from("submission_files").insert(fileRows);
        if (error) throw error;
      } catch (error) {
        if (uploadedPaths.length) await supabase.storage.from("proofs").remove(uploadedPaths);
        throw error;
      }
      if (isRetry && subId) {
        const { error: consentError } = await supabase
          .from("submission_chat_shares")
          .delete()
          .eq("submission_id", subId)
          .eq("user_id", userId);
        if (consentError) throw consentError;
      }
      if (shareInChat && subId) {
        const { error: consentError } = await supabase
          .from("submission_chat_shares")
          .insert({ submission_id: subId, user_id: userId });
        if (consentError)
          throw new Error(
            "A comprovação foi enviada, mas não foi possível registrar a autorização para o chat. Ela continuará privada. Confira seu envio antes de tentar novamente.",
          );
      }
      if (isRetry && subId) {
        const { error } = await supabase.rpc("resubmit_proof", { _submission_id: subId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        shareInChat
          ? "Envio recebido! Se aprovado, aparecerá no chat geral."
          : "Envio recebido! Aguarde a validação da organização.",
      );
      setFiles([]);
      setShareInChat(false);
      if (inputRef.current) inputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["submission", id, userId] });
      queryClient.invalidateQueries({ queryKey: ["submission-files"] });
      queryClient.invalidateQueries({ queryKey: ["my-submissions", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Não foi possível enviar.");
      queryClient.invalidateQueries({ queryKey: ["submission", id, userId] });
      queryClient.invalidateQueries({ queryKey: ["submission-files"] });
    },
    onSettled: () => setUploadStep(""),
  });

  if (challengePending)
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando desafio…</p>;
  if (challengeError || !challenge)
    return <p className="py-10 text-center text-sm text-muted-foreground">Desafio indisponível.</p>;

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
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/95 via-primary/80 to-background/65"
        />
        <div className="flex flex-wrap items-center gap-2">
          {challenge.type === "relampago" && (
            <Badge className="gap-1 bg-warning text-warning-foreground">
              <Zap className="size-3" /> Relâmpago
            </Badge>
          )}
          <span
            className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", stateClass[state])}
          >
            {stateLabel[state]}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}
          >
            {status.text}
          </span>
        </div>
        <h1 className="text-2xl font-bold">{challenge.title}</h1>
        <p className="text-sm text-primary-foreground/80">{challenge.description}</p>
        <p className="text-sm">
          <span className="font-semibold">+{challenge.points} pontos</span> ·{" "}
          {formatDateTime(challenge.starts_at)} até {formatDateTime(challenge.ends_at)}
        </p>
        {state === "ativo" && (
          <p className="text-sm font-semibold text-primary-foreground">
            Tempo restante: <TimeRemaining at={challenge.ends_at} />
          </p>
        )}
      </section>

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <h2 className="font-semibold">Como participar</h2>
          <p className="whitespace-pre-wrap text-muted-foreground">{challenge.instructions}</p>
          {challenge.extra_rules && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
              Regras: {challenge.extra_rules}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Comprovação: {challenge.requires_photo ? "foto" : ""}
            {challenge.requires_photo && challenge.requires_video ? " e " : ""}
            {challenge.requires_video ? "vídeo" : ""} · até {maxFileMb} MB por arquivo
          </p>
        </CardContent>
      </Card>

      {submission && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Seu envio</h2>
            <p className="text-xs text-muted-foreground">
              Enviado em {formatDateTime(submission.submitted_at)}
            </p>
            {submission.status === "rejected" && submission.rejection_reason && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Motivo: {submission.rejection_reason}
              </p>
            )}
            <MediaGallery files={myFiles} />
          </CardContent>
        </Card>
      )}

      {settingsError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível consultar os limites do evento. Atualize a página antes de enviar.
        </p>
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
                  toast.error(`Cada arquivo pode ter no máximo ${maxFileMb} MB.`);
                  return;
                }
                setFiles(picked);
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
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
            <div className="flex items-center gap-3 border-t border-border pt-3">
              <Switch
                id="share-proof-in-chat"
                checked={shareInChat}
                onCheckedChange={setShareInChat}
                disabled={upload.isPending}
                aria-label="Mostrar foto ou vídeo no chat geral após aprovação"
              />
              <label
                htmlFor="share-proof-in-chat"
                className="min-w-0 cursor-pointer text-sm font-medium"
              >
                Mostrar para todos no chat geral?
                <span className="block text-xs font-normal text-muted-foreground">
                  Opcional. Só aparece após a organização aprovar. Desligado mantém sua mídia
                  privada.
                </span>
              </label>
            </div>
            <Button
              className="w-full"
              disabled={upload.isPending || files.length === 0}
              onClick={() => upload.mutate()}
            >
              {upload.isPending ? uploadStep || "Preparando envio…" : "Enviar para validação"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {settings?.finished
            ? "O evento foi encerrado para novos envios."
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
