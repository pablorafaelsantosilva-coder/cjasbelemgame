import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import { liveState, type Challenge } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChallengeActions({
  challenge,
  finished,
}: {
  challenge: Challenge;
  finished: boolean;
}) {
  const { userId } = useSession();
  const now = useNow();
  const client = useQueryClient();
  const [manualLink, setManualLink] = useState("");
  const [sharing, setSharing] = useState(false);
  const state = liveState(challenge, new Date(now));
  const eligible = !finished && (state === "ativo" || state === "agendado");
  const key = ["challenge-reminder", userId, challenge.id];
  const reminder = useQuery({
    queryKey: key,
    enabled: !!userId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_reminders")
        .select("kind,delivered_at")
        .eq("user_id", userId!)
        .eq("challenge_id", challenge.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_challenge_reminder", {
        _challenge: challenge.id,
        _enabled: !reminder.data,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(
        reminder.data ? "Lembrete removido." : "Lembrete ativado nas notificações do site.",
      );
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: ["unread", userId] });
    },
    onError: () => toast.error("Não foi possível salvar o lembrete. Tente novamente."),
  });
  async function share() {
    setSharing(true);
    const url = new URL(`/desafio/${challenge.id}`, window.location.origin).href;
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: challenge.title,
            text: `Participe do desafio: ${challenge.title}`,
            url,
          });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link do desafio copiado!");
      } catch {
        setManualLink(url);
      }
    } finally {
      setSharing(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={share} disabled={sharing}>
          <Share2 className="mr-2 size-4" />
          Compartilhar desafio
        </Button>
        {(eligible || reminder.data) && (
          <Button
            variant={reminder.data ? "secondary" : "outline"}
            size="sm"
            aria-pressed={!!reminder.data}
            disabled={toggle.isPending || reminder.isPending || reminder.isError}
            onClick={() => toggle.mutate()}
          >
            {reminder.data ? <BellOff className="mr-2 size-4" /> : <Bell className="mr-2 size-4" />}
            {reminder.data ? "Remover lembrete" : "Lembrar-me"}
          </Button>
        )}
      </div>
      {(challenge.first_photo_bonus ?? 0) > 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm font-medium">
          🏆 +{challenge.first_photo_bonus} pontos extras pela primeira foto válida enviada! O bônus
          é confirmado após a avaliação dos envios anteriores, independentemente da ordem de
          aprovação. Reenvios contam a partir do novo envio.
        </p>
      )}
      {manualLink && (
        <label className="block text-sm">
          Copie o link do desafio
          <Input readOnly value={manualLink} onFocus={(e) => e.target.select()} />
        </label>
      )}
      {eligible && (
        <p className="text-xs text-muted-foreground">
          {reminder.isError
            ? "Lembretes indisponíveis. A organização precisa verificar a atualização do banco."
            : reminder.data?.delivered_at
              ? "Lembrete enviado. Confira suas notificações."
              : (reminder.data?.kind ?? (state === "agendado" ? "start" : "ending")) === "start"
                ? "Aviso no site quando o desafio abrir."
                : "Aviso no site nos últimos 10 minutos do desafio."}{" "}
          Requer o site aberto ou retornar antes do prazo. Não envia e-mail nem notificação com o
          navegador fechado.
        </p>
      )}
    </div>
  );
}
