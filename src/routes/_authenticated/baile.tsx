import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, PartyPopper, Trash2, Upload, Vote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QueryFeedback } from "@/components/QueryFeedback";

const LIMIT = 20;
const BUCKET = "costumes";

export const Route = createFileRoute("/_authenticated/baile")({
  head: () => ({
    meta: [
      { title: "Baile à fantasia — CJAS Belém Game" },
      { name: "description", content: "Inscreva sua fantasia no desfile e vote na melhor." },
      { property: "og:title", content: "Baile à fantasia — CJAS Belém Game" },
      { property: "og:description", content: "Inscrições para o desfile e votação da melhor fantasia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CostumeBallPage,
});

type Entry = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  costume_name: string;
  description: string;
  photo_path: string;
  created_at: string;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Algo deu errado. Tente novamente.";
}

function CostumeBallPage() {
  const { userId } = useSession();
  const { data: isAdmin } = useIsAdmin(userId);
  const qc = useQueryClient();

  const entriesQ = useQuery({
    queryKey: ["costume-entries"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costume_entries")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Entry[];
      const paths = rows.map((r) => r.photo_path);
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        signed?.forEach((s) => {
          if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
        });
      }
      return { rows, urls };
    },
  });

  const resultsQ = useQuery({
    queryKey: ["costume-results"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_costume_results");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r) => (map[r.entry_id] = Number(r.votes)));
      return map;
    },
  });

  const myVoteQ = useQuery({
    queryKey: ["costume-my-vote", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costume_votes")
        .select("entry_id")
        .eq("voter_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.entry_id ?? null;
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["costume-entries"] });
    void qc.invalidateQueries({ queryKey: ["costume-results"] });
    void qc.invalidateQueries({ queryKey: ["costume-my-vote"] });
  };

  const vote = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("costume_votes")
        .upsert({ voter_id: userId!, entry_id: entryId }, { onConflict: "voter_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voto registrado!");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: async (entry: Entry) => {
      const { error } = await supabase.from("costume_entries").delete().eq("id", entry.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([entry.photo_path]);
    },
    onSuccess: () => {
      toast.success("Inscrição removida.");
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = entriesQ.data?.rows ?? [];
  const urls = entriesQ.data?.urls ?? {};
  const results = resultsQ.data ?? {};
  const mine = rows.find((r) => r.user_id === userId);
  const full = rows.length >= LIMIT;
  const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(0, ...Object.values(results));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <PartyPopper className="mb-3 size-7 text-primary" />
        <h1 className="text-2xl font-bold">Baile à fantasia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inscreva sua fantasia para o desfile e vote na sua favorita. Cada pessoa tem 1 voto e
          pode trocá-lo até o fim.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            {rows.length}/{LIMIT} vagas
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            {totalVotes} votos
          </span>
        </div>
      </section>

      {!mine && !entriesQ.isLoading && (
        full ? (
          <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            As {LIMIT} vagas do concurso já foram preenchidas. Você ainda pode votar!
          </p>
        ) : (
          userId && <EntryForm userId={userId} onDone={refresh} />
        )
      )}

      <QueryFeedback
        isLoading={entriesQ.isLoading}
        isError={entriesQ.isError}
        onRetry={() => void entriesQ.refetch()}
      />

      {rows.length === 0 && !entriesQ.isLoading && (
        <p className="text-center text-sm text-muted-foreground">
          Ninguém se inscreveu ainda. Seja o primeiro!
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r, i) => {
          const votes = results[r.id] ?? 0;
          const leading = votes > 0 && votes === maxVotes;
          const voted = myVoteQ.data === r.id;
          const own = r.user_id === userId;
          return (
            <article key={r.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="relative aspect-[3/4] bg-muted">
                {urls[r.photo_path] && (
                  <img
                    src={urls[r.photo_path]}
                    alt={`${r.first_name} fantasiado de ${r.costume_name}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-bold">
                  #{i + 1}
                </span>
                {leading && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    <Crown className="size-3" /> Liderando
                  </span>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div>
                  <h2 className="text-lg font-bold leading-tight">{r.costume_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {r.first_name} {r.last_name}
                  </p>
                </div>
                {r.description && <p className="text-sm">{r.description}</p>}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {votes} {votes === 1 ? "voto" : "votos"}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {(own || isAdmin) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover inscrição"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm("Remover esta inscrição?")) remove.mutate(r);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    {!own && (
                      <Button
                        size="sm"
                        variant={voted ? "default" : "outline"}
                        disabled={voted || vote.isPending}
                        onClick={() => vote.mutate(r.id)}
                      >
                        <Vote className="size-4" />
                        {voted ? "Seu voto" : "Votar"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EntryForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [costume, setCostume] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Escolha uma foto fantasiado.");
      if (!file.type.startsWith("image/")) throw new Error("O arquivo precisa ser uma foto.");
      if (file.size > 10 * 1024 * 1024) throw new Error("A foto deve ter até 10 MB.");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.from("costume_entries").insert({
        user_id: userId,
        first_name: first,
        last_name: last,
        costume_name: costume,
        description: desc,
        photo_path: path,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Inscrição confirmada! Boa sorte no desfile.");
      onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <h2 className="text-lg font-bold">Inscrever minha fantasia</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cb-first">Nome</Label>
          <Input id="cb-first" required maxLength={60} value={first} onChange={(e) => setFirst(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cb-last">Sobrenome</Label>
          <Input id="cb-last" required maxLength={80} value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cb-costume">Nome da fantasia</Label>
        <Input id="cb-costume" required maxLength={80} value={costume} onChange={(e) => setCostume(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cb-desc">Conte sobre sua fantasia (opcional)</Label>
        <Textarea id="cb-desc" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cb-photo">Foto fantasiado</Label>
        <Input
          id="cb-photo"
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submit.isPending}>
        {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Confirmar inscrição
      </Button>
    </form>
  );
}
