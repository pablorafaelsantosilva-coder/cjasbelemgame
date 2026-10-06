import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChatReadiness } from "@/components/admin/ChatReadiness";
import { QueryFeedback } from "@/components/QueryFeedback";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel da organização — CJAS Belém Game" },
      {
        name: "description",
        content: "Resumo do evento: participantes, envios pendentes e desafios ativos.",
      },
      { property: "og:title", content: "Painel da organização — CJAS Belém Game" },
      { property: "og:description", content: "Resumo do evento em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

function useCount(key: string, run: () => Promise<number>) {
  return useQuery({ queryKey: ["admin-count", key], refetchInterval: 20_000, queryFn: run });
}

function AdminHome() {
  const participants = useCount("participants", async () => {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  });
  const pending = useCount("pending", async () => {
    const { count, error } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted");
    if (error) throw error;
    return count ?? 0;
  });
  const confirmed = useCount("confirmed", async () => {
    const { count, error } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed");
    if (error) throw error;
    return count ?? 0;
  });
  const challenges = useCount("challenges", async () => {
    const { count, error } = await supabase
      .from("challenges")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  });

  const cards = [
    { label: "Participantes", value: participants.data ?? "—" },
    { label: "Aguardando validação", value: pending.data ?? "—" },
    { label: "Atividades confirmadas", value: confirmed.data ?? "—" },
    { label: "Desafios criados", value: challenges.data ?? "—" },
  ];

  return (
    <div className="space-y-4">
      {[participants, pending, confirmed, challenges].some((q) => q.isError) && (
        <QueryFeedback
          message="Alguns indicadores não foram carregados."
          onRetry={() => {
            for (const q of [participants, pending, confirmed, challenges]) void q.refetch();
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-extrabold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ChatReadiness />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/admin/validacoes">Validar envios</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/desafios">Criar desafio</Link>
        </Button>
      </div>
    </div>
  );
}
