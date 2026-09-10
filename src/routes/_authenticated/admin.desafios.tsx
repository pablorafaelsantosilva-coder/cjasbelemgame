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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, liveState, stateClass, stateLabel, type Challenge } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — CJAS Belém Game" },
      { name: "description", content: "Crie, agende e encerre desafios normais e relâmpago do evento." },
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
  type: "normal" as "normal" | "relampago",
  starts_at: toLocalInput(new Date()),
  ends_at: toLocalInput(new Date(Date.now() + 3 * 3600_000)),
  requires_photo: true,
  requires_video: false,
  allow_resubmit: true,
  audience: "",
  extra_rules: "",
  status: "agendado" as "rascunho" | "agendado",
});

function AdminChallenges() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges").select("*").order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (form.title.trim().length < 3) throw new Error("Informe um título.");
      if (new Date(form.ends_at) <= new Date(form.starts_at)) throw new Error("O encerramento deve ser depois do início.");
      const { error } = await supabase.from("challenges").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        points: Number(form.points) || 0,
        type: form.type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        requires_photo: form.requires_photo,
        requires_video: form.requires_video,
        allow_resubmit: form.allow_resubmit,
        audience: form.audience.trim() || null,
        extra_rules: form.extra_rules.trim() || null,
        status: form.status,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desafio salvo.");
      setForm(emptyForm());
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
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
    },
    onError: () => toast.error("Não foi possível atualizar o desafio."),
  });

  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen((o) => !o)}>{open ? "Fechar formulário" : "Novo desafio"}</Button>

      {open && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Instruções</Label>
              <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
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
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "normal" | "relampago" })}>
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
              <Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
            </div>
            <div>
              <Label>Regras extras (opcional)</Label>
              <Input value={form.extra_rules} onChange={(e) => setForm({ ...form, extra_rules: e.target.value })} />
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
                onValueChange={(v) => setForm({ ...form, status: v as "rascunho" | "agendado" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado (publica sozinho)</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="sm:col-span-2" disabled={create.isPending} onClick={() => create.mutate()}>
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
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", stateClass[state])}>
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
                  {c.status === "rascunho" && (
                    <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: "agendado" })}>
                      Publicar/agendar
                    </Button>
                  )}
                  {c.status === "agendado" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: c.id, status: "encerrado" })}>
                      Encerrar agora
                    </Button>
                  )}
                  {c.status !== "cancelado" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setStatus.mutate({ id: c.id, status: "cancelado" })}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
