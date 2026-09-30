import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/MediaGallery";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, submissionLabel } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/midias")({
  head: () => ({ meta: [
    { title: "Mídias dos desafios — CJAS Belém Game" },
    { name: "description", content: "Comprovações organizadas por desafio e participante para a equipe do evento." },
    { property: "og:title", content: "Mídias dos desafios — CJAS Belém Game" },
    { property: "og:description", content: "Fotos e vídeos dos desafios organizados por participante." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: AdminMedia,
});

const PAGE_SIZE = 30;
type MediaRow = { id: string; user_id: string; challenge_id: string; status: "submitted" | "confirmed" | "rejected"; submitted_at: string; submission_files: { id: string; storage_path: string; file_type: string }[] };

function AdminMedia() {
  const [challengeId, setChallengeId] = useState("all");
  const [participantId, setParticipantId] = useState("all");
  const [page, setPage] = useState(0);

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-media-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("id,title").order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: participants = [] } = useQuery({
    queryKey: ["admin-media-participants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["admin-media", challengeId, participantId, page],
    queryFn: async () => {
      let query = supabase.from("submissions")
        .select("id,user_id,challenge_id,status,submitted_at,submission_files(id,storage_path,file_type)", { count: "exact" })
        .order("submitted_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (challengeId !== "all") query = query.eq("challenge_id", challengeId);
      if (participantId !== "all") query = query.eq("user_id", participantId);
      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: rows ?? [], count: count ?? 0 };
    },
  });

  const challengeNames = new Map(challenges.map((c) => [c.id, c.title]));
  const participantNames = new Map(participants.map((p) => [p.id, p.name]));
  const groups = new Map<string, MediaRow[]>();
  for (const row of data?.rows ?? []) {
    const existing = groups.get(row.challenge_id) ?? [];
    existing.push(row);
    groups.set(row.challenge_id, existing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Mídias dos desafios</h2>
        <p className="text-sm text-muted-foreground">Fotos e vídeos organizados por desafio e participante.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="media-challenge">Desafio</label>
          <Select value={challengeId} onValueChange={(value) => { setChallengeId(value); setPage(0); }}>
            <SelectTrigger id="media-challenge"><SelectValue placeholder="Todos os desafios" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os desafios</SelectItem>
              {challenges.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="media-participant">Participante</label>
          <Select value={participantId} onValueChange={(value) => { setParticipantId(value); setPage(0); }}>
            <SelectTrigger id="media-participant"><SelectValue placeholder="Todos os participantes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os participantes</SelectItem>
              {participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Carregando mídias…</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar as mídias.</p>}
      {!isPending && !isError && data.count === 0 && <p className="text-sm text-muted-foreground">Nenhuma comprovação encontrada.</p>}
      {[...groups].map(([id, rows]) => (
        <section key={id} className="space-y-3 border-t border-border pt-5">
          <h3 className="text-lg font-semibold">{challengeNames.get(id) ?? "Desafio"}</h3>
          <div className="space-y-5">
            {rows.map((row) => {
              const status = submissionLabel(row.status);
              return (
                <div key={row.id} className="space-y-3 border-b border-border pb-5 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{participantNames.get(row.user_id) ?? "Participante"}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", status.className)}>{status.text}</span>
                    <span className="text-muted-foreground">{formatDateTime(row.submitted_at)}</span>
                  </div>
                  <MediaGallery files={row.submission_files ?? []} columns="grid-cols-2 gap-2 sm:grid-cols-4" />
                  {(row.submission_files?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem arquivos anexados.</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!isPending && !isError && data.count > PAGE_SIZE && (
        <nav aria-label="Páginas de mídias" className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page + 1} de {Math.ceil(data.count / PAGE_SIZE)}</span>
          <Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= data.count} onClick={() => setPage((n) => n + 1)}>Próxima</Button>
        </nav>
      )}
    </div>
  );
}