import { useNow } from "@/hooks/useNow";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Zap,
  ChevronRight,
  Trophy,
  CheckCircle2,
  Hourglass,
  MessageCircle,
  Images,
  ArrowRight,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryFeedback } from "@/components/QueryFeedback";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Meus desafios — CJAS Belém Game" },
      {
        name: "description",
        content: "Acompanhe desafios ativos, prazos e sua pontuação no CJAS Belém Game.",
      },
      { property: "og:title", content: "Meus desafios — CJAS Belém Game" },
      { property: "og:description", content: "Acompanhe desafios ativos, prazos e sua pontuação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const now = useNow();

  const { data: settings } = useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: challenges = [],
    isPending: loadingChallenges,
    isError: challengesError,
    refetch: retryChallenges,
  } = useQuery({
    queryKey: ["challenges"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .neq("status", "rascunho")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });

  const {
    data: submissions = [],
    isPending: loadingSubmissions,
    isError: submissionsError,
    refetch: retrySubmissions,
  } = useQuery({
    queryKey: ["my-submissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", userId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rank = leaderboard.find((row) => row.id === userId)?.rank_position;
  const [filter, setFilter] = useState<"all" | "todo" | "submitted" | "confirmed">("all");

  const byChallenge = new Map<string, Submission>();
  for (const s of submissions)
    if (!byChallenge.has(s.challenge_id)) byChallenge.set(s.challenge_id, s);

  const visible = challenges.filter((c) => liveState(c, new Date(now)) !== "rascunho");
  const active = visible.filter((c) => liveState(c, new Date(now)) === "ativo");
  const upcoming = visible.filter((c) => liveState(c, new Date(now)) === "agendado");
  const closed = visible.filter((c) =>
    ["encerrado", "cancelado"].includes(liveState(c, new Date(now))),
  );

  const confirmedCount = visible.filter(
    (c) => byChallenge.get(c.id)?.status === "confirmed",
  ).length;
  const pendingCount = visible.filter((c) => byChallenge.get(c.id)?.status === "submitted").length;
  const progress = visible.length ? Math.round((confirmedCount / visible.length) * 100) : 0;
  const matches = (c: Challenge) =>
    filter === "all" ||
    (filter === "todo"
      ? !byChallenge.has(c.id) || byChallenge.get(c.id)?.status === "rejected"
      : byChallenge.get(c.id)?.status === filter);
  const next =
    !settings?.finished && !submissionsError && !loadingSubmissions
      ? [...active]
          .filter(
            (c) =>
              !byChallenge.has(c.id) ||
              (byChallenge.get(c.id)?.status === "rejected" && c.allow_resubmit),
          )
          .sort((a, b) => a.ends_at.localeCompare(b.ends_at))[0]
      : undefined;
  return (
    <div className="space-y-6">
      <section className="animate-rise-in relative isolate overflow-hidden rounded-2xl p-5 text-white shadow-lg">
        <img
          src={bgAsset.url}
          fetchPriority="high"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/75 dark:from-black/90 dark:via-black/75 dark:to-black/60"
        />
        <p className="text-sm opacity-80">
          Olá, {profile?.name?.split(" ")[0] ?? "participante"} 👋
        </p>
        <h1 className="mt-1 text-2xl font-bold">{settings?.name ?? "CJAS Belém Game"}</h1>
        <div className="mt-5 flex gap-8">
          <div>
            <p className={cn("text-3xl font-extrabold", rank === 1 ? "rgb-points" : "text-white")}>
              {profile?.total_points ?? 0}
            </p>
            <p className="text-xs opacity-80">pontos</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-3xl font-extrabold">
              <Trophy className="size-5" />
              {rank ? `${rank}º` : "—"}
            </p>
            <p className="text-xs opacity-80">no ranking</p>
          </div>
        </div>
        {settings?.finished && (
          <p className="mt-4 rounded-lg bg-background/15 px-3 py-2 text-sm">
            🎉 O evento foi encerrado. Confira o ranking final!
          </p>
        )}
      </section>

      {settings?.org_message && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {settings.org_message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/chat"
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft hover-lift"
        >
          <MessageCircle className="size-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold">
            Conversar
            <span className="block text-xs font-normal text-muted-foreground">Geral e privado</span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0" />
        </Link>
        <Link
          to="/memorias"
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft hover-lift"
        >
          <Images className="size-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold">
            Memórias
            <span className="block text-xs font-normal text-muted-foreground">
              Momentos do evento
            </span>
          </span>
          <ChevronRight className="ml-auto size-4 shrink-0" />
        </Link>
      </div>
      {challengesError || submissionsError ? (
        <QueryFeedback
          message="Não foi possível carregar todos os seus desafios e envios."
          onRetry={() => {
            void retryChallenges();
            void retrySubmissions();
          }}
        />
      ) : loadingChallenges || loadingSubmissions ? (
        <div role="status" className="space-y-3 rounded-2xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Preparando sua jornada…</p>
          <div className="h-3 animate-pulse rounded-full bg-secondary" />
          <div className="h-12 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sua jornada
              </p>
              <h2 className="mt-1 font-bold">Cada desafio é uma nova conquista</h2>
            </div>
            <Target className="size-7 shrink-0 text-primary" />
          </div>
          <div
            role="progressbar"
            aria-label="Desafios confirmados"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-info" />
              {confirmedCount} de {visible.length} confirmados
            </span>
            <span className="flex items-center gap-1.5">
              <Hourglass className="size-4 text-success" />
              {pendingCount} em análise
            </span>
          </div>
        </section>
      )}
      {next && (
        <Link
          to="/desafio/$id"
          params={{ id: next.id }}
          className="flex items-center gap-4 rounded-2xl border border-primary/25 bg-card p-5 shadow-soft hover-lift"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary">Seu próximo passo</p>
            <h2 className="mt-1 truncate font-bold">{next.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              +{next.points} pontos · Encerra em <TimeRemaining at={next.ends_at} />
            </p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-primary" />
        </Link>
      )}
      <div role="group" aria-label="Filtrar desafios" className="flex flex-wrap gap-2">
        {(
          [
            { value: "all", label: "Todos" },
            { value: "todo", label: "Para fazer" },
            { value: "submitted", label: "Em análise" },
            { value: "confirmed", label: "Confirmados" },
          ] as const
        ).map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            className="rounded-full"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <Section
        title="Desafios ativos"
        empty={loadingChallenges ? "Carregando…" : "Nenhum desafio ativo neste filtro."}
      >
        {active.filter(matches).map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>

      <Section
        title="Em breve"
        empty={loadingChallenges ? "Carregando…" : "Nenhum desafio programado neste filtro."}
      >
        {upcoming.filter(matches).map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>

      <Section
        title="Encerrados"
        empty={loadingChallenges ? "Carregando…" : "Nenhum desafio encerrado neste filtro."}
      >
        {closed.filter(matches).map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="stagger-children space-y-3">{children}</div>
      )}
    </section>
  );
}

function ChallengeCard({
  challenge,
  submission,
  now,
}: {
  challenge: Challenge;
  submission?: Submission | undefined;
  now: number;
}) {
  const state = liveState(challenge, new Date(now));
  const status = submissionLabel(submission?.status);
  return (
    <Link to="/desafio/$id" params={{ id: challenge.id }} className="block">
      <Card className="hover-lift press-in">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {challenge.type === "relampago" && (
                <Badge className="gap-1 bg-warning text-warning-foreground">
                  <Zap className="size-3" /> Relâmpago
                </Badge>
              )}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  stateClass[state],
                )}
              >
                {stateLabel[state]}
              </span>
              <span
                className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}
              >
                {status.text}
              </span>
            </div>
            <p className="line-clamp-2 font-semibold">{challenge.title}</p>
            <p
              className={cn(
                "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground",
                state === "ativo" &&
                  challenge.type === "relampago" &&
                  "animate-urgent font-medium text-warning",
              )}
            >
              <Clock className="size-3.5" />
              {state === "ativo" ? (
                <>
                  Encerra em <TimeRemaining at={challenge.ends_at} />
                </>
              ) : state === "agendado" ? (
                <>
                  Abre em <TimeRemaining at={challenge.starts_at} />
                </>
              ) : (
                formatDateTime(challenge.ends_at)
              )}
              <span className="ml-2 font-semibold text-foreground">+{challenge.points} pts</span>
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

function TimeRemaining({ at }: { at: string }) {
  const now = useNow(1000);
  return <span>{countdown(at, now)}</span>;
}
