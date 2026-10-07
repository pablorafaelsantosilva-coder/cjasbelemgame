import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do evento — CJAS Belém Game" },
      {
        name: "description",
        content: "Defina nome, datas, regras, recado da organização e encerramento do evento.",
      },
      { property: "og:title", content: "Configurações do evento — CJAS Belém Game" },
      { property: "og:description", content: "Nome, datas, regras e encerramento do evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    rules: "",
    org_message: "",
    finished: false,
    max_file_mb: 100,
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data } = useQuery({
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

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      start_date: data.start_date.slice(0, 10),
      end_date: data.end_date.slice(0, 10),
      rules: data.rules,
      org_message: data.org_message,
      finished: data.finished,
      max_file_mb: data.max_file_mb,
    });
  }, [data]);

  async function save() {
    if (!Number.isInteger(form.max_file_mb) || form.max_file_mb < 1 || form.max_file_mb > 100) {
      toast.error("O limite deve ser de 1 a 100 MB.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("event_settings")
      .update({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        rules: form.rules,
        org_message: form.org_message,
        finished: form.finished,
        max_file_mb: form.max_file_mb,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as configurações.");
      return;
    }
    toast.success("Configurações salvas.");
    queryClient.invalidateQueries({ queryKey: ["event-settings"] });
  }

  async function resetRanking() {
    setResetting(true);
    const { error } = await supabase.rpc("reset_leaderboard");
    setResetting(false);
    if (error) {
      toast.error("Não foi possível zerar o ranking.");
      return;
    }
    toast.success("Ranking zerado.");
    queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome do evento</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Início</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Fim</Label>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="max-file-mb">Tamanho máximo por arquivo (MB)</Label>
            <Input
              id="max-file-mb"
              type="number"
              min={1}
              max={100}
              value={form.max_file_mb}
              onChange={(e) => setForm({ ...form, max_file_mb: Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Até 100 MB, conforme o limite disponível no armazenamento do projeto.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Regras gerais</Label>
            <Textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={4}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Recado da organização</Label>
            <Textarea
              value={form.org_message}
              onChange={(e) => setForm({ ...form, org_message: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch
              checked={form.finished}
              onCheckedChange={(v) => setForm({ ...form, finished: v })}
            />
            Encerrar o evento (bloqueia novos envios e mostra o ranking final)
          </label>
          <Button className="sm:col-span-2" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="font-semibold text-destructive">Zerar ranking</p>
            <p className="text-sm text-muted-foreground">
              Apaga todo o histórico de pontos e coloca todos os participantes em zero. As
              atividades continuam no lugar.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={resetting}>
                {resetting ? "Zerando…" : "Zerar ranking"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zerar a pontuação de todos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os pontos e o histórico de pontuação serão apagados. Não dá para desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={resetRanking}>Zerar tudo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
