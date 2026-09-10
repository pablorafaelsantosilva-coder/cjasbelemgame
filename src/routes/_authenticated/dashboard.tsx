import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Zap, ChevronRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
      { name: "description", content: "Acompanhe desafios ativos, prazos e sua pontuação no CJAS Belém Game." },
      { property: "og:title", content: "Meus desafios — CJAS Belém Game" },
      { property: "og:description", content: "Acompanhe desafios ativos, prazos e sua pontuação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const now = useNow();

  const { data: settings } = useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: challenges = [] } = useQuery({
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

  const { data: submissions = [] } = useQuery({
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

  const { data: rank } = useQuery({
    queryKey: ["my-rank", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      const me = (data ?? []).find((r) => r.id === userId);
      return me?.rank_position ?? null;
    },
  });

  const byChallenge = new Map<string, Submission>();
  for (const s of submissions) if (!byChallenge.has(s.challenge_id)) byChallenge.set(s.challenge_id, s);

  const visible = challenges.filter((c) => liveState(c, new Date(now)) !== "rascunho");
  const active = visible.filter((c) => liveState(c, new Date(now)) === "ativo");
  const upcoming = visible.filter((c) => liveState(c, new Date(now)) === "agendado");
  const closed = visible.filter((c) => ["encerrado", "cancelado"].includes(liveState(c, new Date(now))));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-lg">
        <p className="text-sm opacity-80">Olá, {profile?.name?.split(" ")[0] ?? "participante"} 👋</p>
        <h1 className="mt-1 text-2xl font-bold">{settings?.name ?? "CJAS Belém Game"}</h1>
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-3xl font-extrabold">{profile?.total_points ?? 0}</p>
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
          <CardContent className="p-4 text-sm text-muted-foreground">{settings.org_message}</CardContent>
        </Card>
      )}

      <Section title="Desafios ativos" empty="Nenhum desafio ativo neste momento.">
        {active.map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>

      <Section title="Em breve" empty="Nenhum desafio programado.">
        {upcoming.map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>

      <Section title="Encerrados" empty="Nada por aqui ainda.">
        {closed.map((c) => (
          <ChallengeCard key={c.id} challenge={c} submission={byChallenge.get(c.id)} now={now} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
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
    <Link to="/desafio/$id" params={{ id: challenge.id }}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-1.5">
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
            <p className="truncate font-semibold">{challenge.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {state === "ativo"
                ? `Encerra em ${countdown(challenge.ends_at, now)}`
                : state === "agendado"
                  ? `Abre em ${countdown(challenge.starts_at, now)}`
                  : formatDateTime(challenge.ends_at)}
              <span className="ml-2 font-semibold text-foreground">+{challenge.points} pts</span>
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
