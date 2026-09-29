import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MediaPreview } from "@/components/MediaPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REJECTION_REASONS, formatDateTime, submissionLabel } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/validacoes")({
  head: () => ({
    meta: [
      { title: "Validações — CJAS Belém Game" },
      { name: "description", content: "Confirme ou rejeite as comprovações enviadas pelos participantes." },
      { property: "og:title", content: "Validações — CJAS Belém Game" },
      { property: "og:description", content: "Confirme ou rejeite comprovações enviadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidationsPage,
});

type Filter = "submitted" | "confirmed" | "rejected";

function ValidationsPage() {
  const [filter, setFilter] = useState<Filter>("submitted");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-submissions", filter],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, challenges(title,points), profiles!submissions_user_id_fkey(name), submission_files(id,storage_path,file_type)")
        .eq("status", filter)
        .order("submitted_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
      const { error } = await supabase.rpc("review_submission", {
        _submission_id: id,
        _approve: approve,
        ...(reason ? { _reason: reason } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Atividade confirmada." : "Atividade rejeitada.");
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count"] });
    },
    onError: () => toast.error("Não foi possível registrar a decisão."),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["submitted", "confirmed", "rejected"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "submitted" ? "Pendentes" : f === "confirmed" ? "Confirmadas" : "Rejeitadas"}
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Nada por aqui.</p>}

      {rows.map((row) => {
        const challenge = row.challenges as { title: string; points: number } | null;
        const profile = (row.profiles as { name: string } | null)?.name;
        const files = (row.submission_files ?? []) as { id: string; storage_path: string; file_type: string }[];
        const status = submissionLabel(row.status);
        return (
          <Card key={row.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>
                  {status.text}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(row.submitted_at)}</span>
              </div>
              <div>
                <p className="font-semibold">{challenge?.title ?? "Desafio"}</p>
                <p className="text-sm text-muted-foreground">
                  {profile ?? "Participante"} · +{challenge?.points ?? 0} pts
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {files.map((f) => (
                  <MediaPreview key={f.id} path={f.storage_path} fileType={f.file_type} className="aspect-square w-full" />
                ))}
              </div>
              {row.rejection_reason && (
                <p className="text-sm text-destructive">Motivo: {row.rejection_reason}</p>
              )}
              {filter === "submitted" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: row.id, approve: true })}
                  >
                    Confirmar
                  </Button>
                  <Select
                    value={reasons[row.id] ?? ""}
                    onValueChange={(v) => setReasons((r) => ({ ...r, [row.id]: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Motivo da rejeição" />
                    </SelectTrigger>
                    <SelectContent>
                      {REJECTION_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="destructive"
                    disabled={review.isPending || !reasons[row.id]}
                    onClick={() => review.mutate({ id: row.id, approve: false, reason: reasons[row.id]! })}
                  >
                    Rejeitar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
