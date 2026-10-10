import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateTime, liveState, stateClass, stateLabel, type Challenge } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — CJAS Belém Game" },
      {
        name: "description",
        content: "Crie, agende e encerre desafios normais e relâmpago do evento.",
      },
      { property: "og:title", content: "Desafios — CJAS Belém Game" },
      { property: "og:description", content: "Crie, agende e encerre desafios do evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminChallenges,
});

function toLocalInput(date: Date) {
  const off = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - off).toISOString().slice(0, 16);
}

const emptyForm = () => ({
  title: "",
  description: "",
  instructions: "",
  points: 100,
  share_photos_in_chat: false,
  type: "normal" as "normal" | "relampago",
  starts_at: toLocalInput(new Date()),
  ends_at: toLocalInput(new Date(Date.now() + 3 * 3600_000)),
  requires_photo: true,
  requires_video: false,
  allow_resubmit: true,
  audience: "",
  extra_rules: "",
  status: "agendado" as Challenge["status"],
});

function AdminChallenges() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  function editChallenge(c: Challenge) {
    setEditingId(c.id);
    setForm({
      ...c,
      share_photos_in_chat: c.share_photos_in_chat ?? false,
      audience: c.audience ?? "",
      extra_rules: c.extra_rules ?? "",
      starts_at: toLocalInput(new Date(c.starts_at)),
      ends_at: toLocalInput(new Date(c.ends_at)),
    });
    setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Informe um título.");
      if (!Number.isSafeInteger(form.points) || form.points < 0)
        throw new Error("Informe uma pontuação inteira e não negativa.");
      if (
        !Number.isFinite(Date.parse(form.starts_at)) ||
        !Number.isFinite(Date.parse(form.ends_at))
      )
        throw new Error("Informe datas válidas.");
      if (new Date(form.ends_at) <= new Date(form.starts_at))
        throw new Error("O encerramento deve ser depois do início.");
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        points: Number(form.points) || 0,
        share_photos_in_chat: form.share_photos_in_chat,
        type: form.type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        requires_photo: form.requires_photo,
        requires_video: form.requires_video,
        allow_resubmit: form.allow_resubmit,
        audience: form.audience.trim() || null,
        extra_rules: form.extra_rules.trim() || null,
        status: form.status,
      };
      const result = editingId
        ? await supabase
            .from("challenges")
            .update(payload)
            .eq("id", editingId)
            .select("id")
            .single()
        : await supabase
            .from("challenges")
            .insert({ ...payload, created_by: userId })
            .select("id")
            .single();
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Desafio salvo.");
      setForm(emptyForm());
      setEditingId(null);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
      queryClient.invalidateQueries({ queryKey: ["admin-media-challenges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Challenge["status"] }) => {
      const { error } = await supabase.from("challenges").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
      queryClient.invalidateQueries({ queryKey: ["admin-media-challenges"] });
    },
    onError: () => toast.error("Não foi possível atualizar o desafio."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_challenge", { _challenge_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade excluída.");
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenge"] });
      queryClient.invalidateQueries({ queryKey: ["admin-media-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: () => toast.error("Não foi possível excluir a atividade."),
  });

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setEditingId(null);
          setForm(emptyForm());
          setOpen((o) => !o);
        }}
      >
        {open ? "Fechar formulário" : "Novo desafio"}
      </Button>

      {open && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="font-semibold">{editingId ? "Editar desafio" : "Novo desafio"}</h2>
              <p className="text-sm text-muted-foreground">
                Edição disponível com o evento aberto ou encerrado. Editar não reabre o evento.
              </p>
              {editingId && (
                <p className="text-xs text-muted-foreground">
                  Pontos já concedidos são preservados; a nova pontuação vale para as próximas
                  aprovações.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Instruções</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <div>
              <Label>Pontos</Label>
              <Input
                type="number"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as "normal" | "relampago" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="relampago">Relâmpago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Publicação</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Encerramento</Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Público (opcional)</Label>
              <Input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              />
            </div>
            <div>
              <Label>Regras extras (opcional)</Label>
              <Input
                value={form.extra_rules}
                onChange={(e) => setForm({ ...form, extra_rules: e.target.value })}
              />
            </div>
            <div className="rounded-xl border bg-secondary/30 p-4 sm:col-span-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="challenge-chat-photos"
                  checked={form.share_photos_in_chat}
                  onCheckedChange={(value) => setForm({ ...form, share_photos_in_chat: value })}
                />
                <Label htmlFor="challenge-chat-photos">
                  Mostrar fotos deste desafio no chat geral
                </Label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                As fotos aparecem após aprovação, quando o participante autorizar. Desligar impede
                que o chat volte a carregar essas fotos. Vídeos continuam privados.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.requires_photo}
                onCheckedChange={(v) => setForm({ ...form, requires_photo: v })}
              />
              Exige foto
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.requires_video}
                onCheckedChange={(v) => setForm({ ...form, requires_video: v })}
              />
              Exige vídeo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.allow_resubmit}
                onCheckedChange={(v) => setForm({ ...form, allow_resubmit: v })}
              />
              Permitir reenvio após rejeição
            </label>
            <div>
              <Label>Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as Challenge["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado (publica sozinho)</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="sm:col-span-2"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Salvando…" : "Salvar desafio"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {challenges.map((c) => {
          const state = liveState(c);
          return (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      stateClass[state],
                    )}
                  >
                    {stateLabel[state]}
                  </span>
                  {c.type === "relampago" && <span className="text-xs">⚡ Relâmpago</span>}
                  <span className="text-xs text-muted-foreground">+{c.points} pts</span>
                </div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(c.starts_at)} → {formatDateTime(c.ends_at)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={() => editChallenge(c)}
                  >
                    Editar desafio
                  </Button>
                  {c.status === "rascunho" && (
                    <Button
                      size="sm"
                      onClick={() => setStatus.mutate({ id: c.id, status: "agendado" })}
                    >
                      Publicar/agendar
                    </Button>
                  )}
                  {c.status === "agendado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: c.id, status: "encerrado" })}
                    >
                      Encerrar agora
                    </Button>
                  )}
                  {c.status !== "cancelado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: c.id, status: "cancelado" })}
                    >
                      Cancelar
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={remove.isPending}>
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir "{c.title}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A atividade, os envios enviados por ela e os pontos já concedidos serão
                          apagados. Não dá para desfazer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(c.id)}>
                          Excluir atividade
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
