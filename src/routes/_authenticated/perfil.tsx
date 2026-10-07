import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACHIEVEMENTS, formatDateTime } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — CJAS Belém Game" },
      {
        name: "description",
        content: "Seus dados, pontos, conquistas e histórico de pontuação no evento.",
      },
      { property: "og:title", content: "Meu perfil — CJAS Belém Game" },
      { property: "og:description", content: "Seus dados, pontos e conquistas no evento." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  const { data: transactions = [] } = useQuery({
    queryKey: ["my-points", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: confirmed = 0 } = useQuery({
    queryKey: ["confirmed-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("status", "confirmed");
      return count ?? 0;
    },
  });

  const { data: position = 0 } = useQuery({
    queryKey: ["my-rank", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      return (data ?? []).find((r) => r.id === userId)?.rank_position ?? 0;
    },
  });

  async function save() {
    if (name.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", userId!);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Perfil atualizado.");
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  }

  const stats = { points: profile?.total_points ?? 0, confirmed, position };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? ""} />
          <AvatarFallback>{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">{profile?.name}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <p className="text-sm font-semibold">
            {stats.points} pontos {position ? `· ${position}º lugar` : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Label htmlFor="name">Nome exibido</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conquistas
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const earned = a.earned(stats);
            return (
              <Card key={a.id} className={cn(!earned && "opacity-50")}>
                <CardContent className="space-y-1 p-3 text-center">
                  <p className="text-2xl">{a.icon}</p>
                  <p className="text-xs font-semibold">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">{a.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico de pontos
        </h2>
        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum ponto registrado ainda.</p>
        )}
        {transactions.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.description ?? "Pontuação"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(t.created_at)}
                </span>
              </span>
              <span
                className={cn("font-bold", t.points >= 0 ? "text-success" : "text-destructive")}
              >
                {t.points > 0 ? `+${t.points}` : t.points}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>
      <footer className="border-t pt-5 text-center text-sm text-muted-foreground">
        Criado por:{" "}
        <a
          href="https://www.instagram.com/prafaelsants/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline underline-offset-4"
        >
          @prafaelsants
        </a>
      </footer>
    </div>
  );
}
