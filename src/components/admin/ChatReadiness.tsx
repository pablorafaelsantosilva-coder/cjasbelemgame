import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function ChatReadiness() {
  const check = useQuery({
    queryKey: ["admin-chat-readiness"],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const [general, direct, directory, inbox] = await Promise.all([
        supabase.from("chat_messages").select("reply_to_id").limit(0),
        supabase.from("direct_messages").select("id").limit(0),
        supabase.rpc("get_chat_people", { _limit: 1 }),
        supabase.rpc("get_direct_inbox"),
      ]);
      return [
        { name: "Respostas no chat geral", error: general.error },
        { name: "Mensagens privadas", error: direct.error },
        { name: "Busca de participantes", error: directory.error },
        { name: "Lista de conversas", error: inbox.error },
      ];
    },
  });
  const missing = check.data?.some(
    (item) =>
      item.error &&
      ["42703", "42P01", "PGRST202", "PGRST204", "PGRST205"].includes(item.error.code),
  );
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Disponibilidade do chat</h2>
          <p className="text-xs text-muted-foreground">
            Verificação de leitura, sem alterar dados.
          </p>
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label="Verificar chat novamente"
          disabled={check.isFetching}
          onClick={() => check.refetch()}
        >
          <RefreshCw className={check.isFetching ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>
      {check.isPending && <p className="text-sm">Verificando recursos…</p>}
      {check.isError && (
        <p className="text-sm text-destructive">
          Não foi possível verificar. Confira sua conexão e tente novamente.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {check.data?.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 rounded-xl bg-secondary/50 p-3 text-sm"
          >
            {item.error ? (
              <CircleAlert className="size-4 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            )}
            <span>
              {item.name}
              <span className="block text-xs text-muted-foreground">
                {item.error ? "Requer atenção" : "Disponível"}
              </span>
            </span>
          </div>
        ))}
      </div>
      {missing && (
        <div className="space-y-2 rounded-xl bg-warning/10 p-3 text-sm">
          <p className="font-semibold">A atualização do banco ainda está pendente.</p>
          <p>
            Aplique no Lovable/Supabase a migração{" "}
            <code className="break-all text-xs">20261006033000_private_chat_and_replies.sql</code>.
            Depois, clique em verificar novamente.
          </p>
          <p className="text-xs text-muted-foreground">
            Confira também a migração de segurança de comprovações nas instruções da atualização.
          </p>
        </div>
      )}
      {check.data?.some((item) => item.error) && !missing && (
        <p className="text-sm text-destructive">
          Há uma falha de conexão ou permissão. Verifique os registros do serviço antes de alterar o
          banco.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Este diagnóstico não certifica envio, Realtime, políticas de segurança nem capacidade de
        acessos.
      </p>
    </section>
  );
}
