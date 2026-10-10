import { useProfileBio } from "@/hooks/useProfileBio";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { AVATAR_PREFIX, uploadAvatar } from "@/lib/avatars";
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
  const [bio, setBio] = useState("");
  const bioQuery = useProfileBio(userId, userId);
  useEffect(() => {
    if (bioQuery.data !== undefined) setBio(bioQuery.data);
  }, [bioQuery.data, userId]);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function changePhoto(file: File | null) {
    if (!userId || photoBusy) return;
    setPhotoBusy(true);
    let newPath: string | null = null;
    try {
      if (file) newPath = await uploadAvatar(userId, file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: newPath ? `${AVATAR_PREFIX}${newPath}` : null })
        .eq("id", userId)
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível salvar a foto.");
      const previous = profile?.avatar_url;
      if (previous?.startsWith(`${AVATAR_PREFIX}${userId}/`))
        await supabase.storage.from("avatars").remove([previous.slice(AVATAR_PREFIX.length)]);
      await Promise.all(
        ["profile", "leaderboard", "ranking", "direct-inbox", "chat-people"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(file ? "Foto de perfil atualizada." : "Foto de perfil removida.");
    } catch (error) {
      if (newPath) await supabase.storage.from("avatars").remove([newPath]);
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

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
    if (!userId || saving || bioQuery.isPending || bioQuery.isError) return;
    if (name.trim().length < 2 || name.trim().length > 80) {
      toast.error("Informe um nome entre 2 e 80 caracteres.");
      return;
    }
    if (Array.from(bio).length > 150) {
      toast.error("A bio pode ter até 150 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), bio: bio.trim() })
        .eq("id", userId)
        .select("id")
        .single();
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
        queryClient.invalidateQueries({ queryKey: ["profile-bio"] }),
      ]);
      toast.success("Perfil atualizado.");
    } catch {
      toast.error("Não foi possível salvar seu perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const stats = { points: profile?.total_points ?? 0, confirmed, position };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? ""} />
          <AvatarFallback>{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{profile?.name}</h1>
          {bioQuery.data && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{bioQuery.data}</p>
          )}
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <p className="text-sm font-semibold">
            {stats.points} pontos {position ? `· ${position}º lugar` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Escolher foto de perfil"
          disabled={photoBusy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void changePhoto(file);
          }}
        />
        <Button
          variant="outline"
          disabled={photoBusy || !profile}
          onClick={() => photoInput.current?.click()}
        >
          <Camera />
          {photoBusy ? "Atualizando foto…" : "Alterar foto"}
        </Button>
        {profile?.avatar_url && (
          <Button variant="ghost" disabled={photoBusy} onClick={() => void changePhoto(null)}>
            <Trash2 />
            Remover foto
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">
          JPG, PNG ou WebP · até 5 MB · visível aos participantes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Label htmlFor="name">Nome exibido</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              rows={3}
              disabled={saving || bioQuery.isPending || bioQuery.isError}
              placeholder="Conte um pouco sobre você ✨"
              aria-describedby="bio-help bio-count"
              onChange={(e) => setBio(Array.from(e.target.value).slice(0, 150).join(""))}
            />
            <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
              <p id="bio-help">
                Opcional. Visível aos participantes nas conversas privadas. Use emojis e quebras de
                linha.
              </p>
              <span id="bio-count" className="shrink-0">
                {Array.from(bio).length}/150
              </span>
            </div>
            {bioQuery.isError && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar a bio. Se a função acabou de ser adicionada, a organização
                precisa aplicar a atualização do banco.
              </p>
            )}
          </div>
          <Button
            onClick={save}
            disabled={saving || !profile || bioQuery.isPending || bioQuery.isError}
          >
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
