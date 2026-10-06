import { useState } from "react";
import { Search, Trophy, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QueryFeedback } from "@/components/QueryFeedback";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import bgAsset from "@/assets/montanhas.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — CJAS Belém Game" },
      {
        name: "description",
        content: "Classificação geral dos participantes do CJAS Belém Game em tempo real.",
      },
      { property: "og:title", content: "Ranking — CJAS Belém Game" },
      {
        property: "og:description",
        content: "Classificação geral dos participantes em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankingPage,
});

const medals = ["🥇", "🥈", "🥉"];

function RankingPage() {
  const { userId } = useSession();
  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["leaderboard", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const filtered = rows.filter((row) => normalize(row.name).includes(normalize(search.trim())));
  const me = rows.find((row) => row.id === userId);
  const leaders = rows.slice(0, 3);
  return (
    <div className="space-y-4">
      <section className="animate-rise-in relative isolate min-h-32 overflow-hidden rounded-2xl p-5 text-white shadow-lg">
        <img
          src={bgAsset.url}
          fetchPriority="high"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/75 dark:from-black/90 dark:via-black/75 dark:to-black/60"
        />
        <p className="text-xs font-semibold uppercase text-white/75">CJAS Belém Game</p>
        <h1 className="mt-2 text-2xl font-bold">Ranking</h1>
        <p className="mt-1 max-w-md text-sm text-white/80">
          Cada participação conta. Celebre as conquistas da nossa comunidade.
        </p>
      </section>
      {isLoading && (
        <div
          role="status"
          className="animate-pulse rounded-2xl border bg-card p-6 text-sm text-muted-foreground"
        >
          Preparando a classificação…
        </div>
      )}
      {isError && (
        <QueryFeedback
          message="Não foi possível atualizar o ranking."
          onRetry={() => {
            void refetch();
          }}
        />
      )}
      {leaders.length > 0 && !search && (
        <section aria-label="Destaques do ranking" className="grid grid-cols-3 gap-2 sm:gap-4">
          {leaders.map((person, index) => (
            <div
              key={person.id}
              className={cn(
                "relative flex min-w-0 flex-col items-center rounded-2xl border bg-card px-2 py-5 text-center shadow-soft",
                index === 0 && "border-primary/35 bg-gradient-to-b from-accent/50 to-card",
              )}
            >
              <span className="mb-2 text-2xl" aria-hidden>
                {medals[index]}
              </span>
              <Avatar className="mb-3 size-12 border-2 border-primary/15 sm:size-16">
                <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{person.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <p className="line-clamp-2 w-full break-words text-xs font-bold sm:text-sm">
                {person.name}
              </p>
              <p className="mt-2 text-lg font-extrabold text-primary">
                {person.total_points.toLocaleString("pt-BR")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                pontos · {person.rank_position}º lugar
              </p>
            </div>
          ))}
        </section>
      )}
      {me && (
        <section
          aria-label="Sua posição"
          className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-card p-4 shadow-soft"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <Trophy className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Sua posição no evento</p>
            <p className="font-bold">
              {me.rank_position}º lugar{" "}
              <span className="font-normal text-muted-foreground">· {me.total_points} pontos</span>
            </p>
          </div>
          <Sparkles className="size-5 shrink-0 text-primary" />
        </section>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 font-bold">
          Classificação geral{" "}
          <span className="text-xs font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Buscar no ranking"
            placeholder="Buscar participante…"
            className="bg-card pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(50);
            }}
          />
        </div>
      </div>
      <div className="stagger-children space-y-2">
        {filtered.slice(0, limit).map((r) => (
          <Card
            key={r.id}
            className={cn("hover-lift press-in", r.id === userId && "border-primary bg-primary/5")}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <span className="w-8 text-center text-lg font-bold">
                {medals[r.rank_position - 1] ?? r.rank_position}
              </span>
              <Avatar className="size-9">
                <AvatarImage src={r.avatar_url ?? undefined} alt={r.name} />
                <AvatarFallback>{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span
                className={cn("font-bold", r.rank_position === 1 ? "rgb-points" : "text-primary")}
              >
                {r.total_points}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length > limit && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setLimit((value) => value + 50)}
        >
          Mostrar mais participantes
        </Button>
      )}
      {!isLoading && rows.length > 0 && filtered.length === 0 && (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum participante encontrado. Tente outro nome.
        </p>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          O ranking aparece assim que houver pontos confirmados.
        </p>
      )}
    </div>
  );
}
