import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/participantes")({
  head: () => ({
    meta: [
      { title: "Participantes — CJAS Belém Game" },
      { name: "description", content: "Consulte participantes, ajuste pontos manualmente e acompanhe a pontuação." },
      { property: "og:title", content: "Participantes — CJAS Belém Game" },
      { property: "og:description", content: "Consulte participantes e ajuste pontos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminParticipants,
});

function AdminParticipants() {
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { points: string; reason: string }>>({});
  const queryClient = useQueryClient();

  const { data: people = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email,total_points,status")
        .order("total_points", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ id, points, reason }: { id: string; points: number; reason: string }) => {
      const { error } = await supabase.rpc("adjust_points", {
        _user_id: id,
        _points: points,
        _description: reason || "Ajuste manual da organização",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pontos ajustados.");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: () => toast.error("Não foi possível ajustar os pontos."),
  });

  const filtered = people.filter((p) =>
    `${p.name} ${p.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
      {filtered.map((p) => {
        const draft = drafts[p.id] ?? { points: "", reason: "" };
        return (
          <Card key={p.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <span className="font-bold">{p.total_points}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  placeholder="Pontos (+/-)"
                  className="sm:w-36"
                  value={draft.points}
                  onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...draft, points: e.target.value } })}
                />
                <Input
                  placeholder="Justificativa"
                  value={draft.reason}
                  onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...draft, reason: e.target.value } })}
                />
                <Button
                  disabled={adjust.isPending || !draft.points}
                  onClick={() => adjust.mutate({ id: p.id, points: Number(draft.points), reason: draft.reason })}
                >
                  Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum participante encontrado.</p>}
    </div>
  );
}
