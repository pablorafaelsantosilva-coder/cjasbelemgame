import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — CJAS Belém Game" },
      { name: "description", content: "Classificação geral dos participantes do CJAS Belém Game em tempo real." },
      { property: "og:title", content: "Ranking — CJAS Belém Game" },
      { property: "og:description", content: "Classificação geral dos participantes em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankingPage,
});

const medals = ["🥇", "🥈", "🥉"];

function RankingPage() {
  const { userId } = useSession();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ranking</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className={cn(r.id === userId && "border-primary bg-primary/5")}>
            <CardContent className="flex items-center gap-3 p-3">
              <span className="w-8 text-center text-lg font-bold">
                {medals[r.rank_position - 1] ?? r.rank_position}
              </span>
              <Avatar className="size-9">
                <AvatarImage src={r.avatar_url ?? undefined} alt={r.name} />
                <AvatarFallback>{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className="font-bold">{r.total_points}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">O ranking aparece assim que houver pontos confirmados.</p>
      )}
    </div>
  );
}
