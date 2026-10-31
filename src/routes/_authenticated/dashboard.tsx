import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper, ChevronRight, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import bgAsset from "@/assets/montanhas.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Baile à fantasia — CJAS Belém Game" },
      { name: "description", content: "Acesse o Baile à fantasia do CJAS Belém Game." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: settings } = useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
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

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-3xl p-6 text-white shadow-xl sm:p-9">
        <img src={bgAsset.url} alt="" aria-hidden="true" className="absolute inset-0 -z-20 size-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/95 via-primary/85 to-black/75" />
        <p className="text-sm opacity-85">Olá, {profile?.name?.split(" ")[0] ?? "participante"}!</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">CJAS Belém Game</h1>
        <div className="mt-5 flex gap-7">
          <div>
            <p className="text-3xl font-extrabold">{profile?.total_points ?? 0}</p>
            <p className="text-xs opacity-80">pontos</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-3xl font-extrabold"><Trophy className="size-5" />{rank ? `${rank}º` : "—"}</p>
            <p className="text-xs opacity-80">no ranking</p>
          </div>
        </div>
      </section>

      {settings?.org_message && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">{settings.org_message}</CardContent></Card>
      )}

      <Link
        to="/baile"
        className="group relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-primary/50 bg-card p-7 text-center shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl sm:min-h-[390px] sm:p-10"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/10" />
        <span className="relative mb-5 grid size-24 place-items-center rounded-full bg-primary/15 text-6xl shadow-inner sm:size-32 sm:text-7xl">🎭</span>
        <span className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-primary">Evento especial</span>
        <h2 className="relative mt-3 text-4xl font-black tracking-tight sm:text-6xl">BAILE</h2>
        <p className="relative mt-3 max-w-md text-base text-muted-foreground sm:text-lg">
          Baile à fantasia · Inscrições e votação da melhor fantasia
        </p>
        <span className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-bold text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
          Entrar no Baile <ChevronRight className="size-5" />
        </span>
        <PartyPopper className="absolute right-5 top-5 size-7 text-primary/40 sm:right-8 sm:top-8 sm:size-9" />
      </Link>
    </div>
  );
}
