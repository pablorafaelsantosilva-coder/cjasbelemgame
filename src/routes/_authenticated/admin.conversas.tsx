import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole, ArrowLeft } from "lucide-react";
import { reviewPrivateChats, type AdminChatRow } from "@/lib/admin-chat.functions";
import { useIsAdmin, useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/conversas")({
  head: () => ({
    meta: [
      { title: "Consulta de conversas — Organização" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminConversations,
});
function AdminConversations() {
  const { userId } = useSession();
  const { data: admin } = useIsAdmin(userId);
  const read = useServerFn(reviewPrivateChats);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AdminChatRow[]>([]);
  const [pair, setPair] = useState<{ a: string; b: string; title: string } | undefined>();
  const [more, setMore] = useState(false);
  const sequence = useRef(0);
  const credentials = useRef({ pin: "", reason: "" });
  function lock() {
    sequence.current++;
    credentials.current = { pin: "", reason: "" };
    setPin("");
    setReason("");
    setUnlocked(false);
    setItems([]);
    setPair(undefined);
    setBusy(false);
    setError("");
    setMore(false);
  }
  useEffect(() => {
    lock();
  }, [userId]);
  useEffect(() => {
    if (!unlocked) return;
    const timer = setTimeout(lock, 5 * 60_000);
    const onHidden = () => {
      if (document.hidden) lock();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [unlocked]);
  async function load(nextPair?: typeof pair, older = false) {
    const request = ++sequence.current;
    setBusy(true);
    setError("");
    const last = older ? items.at(-1) : undefined;
    if (!older) setItems([]);
    try {
      const rows = await read({
        data: {
          ...credentials.current,
          ...(nextPair ? { pair: { a: nextPair.a, b: nextPair.b } } : {}),
          ...(last ? { cursor: { at: last.created_at, id: last.id } } : {}),
        },
      });
      if (request !== sequence.current) return;
      setItems((old) =>
        older ? [...new Map([...old, ...rows].map((row) => [row.id, row])).values()] : rows,
      );
      setPair(nextPair);
      setMore(rows.length === 50);
      setUnlocked(true);
      setPin("");
    } catch (cause) {
      if (request !== sequence.current) return;
      lock();
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar.");
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  if (!admin) return <p>Acesso restrito à organização.</p>;
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <LockKeyhole className="size-5" />
        Consulta de conversas privadas
      </h2>
      <p className="text-sm text-muted-foreground">
        Os administradores podem ter acesso às conversas privadas em casos de violação das regras.
        Toda consulta exige justificativa e fica registrada na auditoria.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!unlocked ? (
        <form
          className="max-w-lg space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            credentials.current = { pin, reason };
            void load();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="review-reason">Motivo da consulta</Label>
            <Textarea
              id="review-reason"
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Informe a violação relatada e o motivo da verificação."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-pin">Senha adicional</Label>
            <Input
              id="review-pin"
              type="password"
              autoComplete="off"
              required
              minLength={4}
              maxLength={128}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </div>
          <Button disabled={busy || reason.trim().length < 10 || pin.length < 4} type="submit">
            {busy ? "Verificando…" : "Acessar conversas"}
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {pair && (
              <Button disabled={busy} variant="outline" onClick={() => load()}>
                <ArrowLeft className="mr-2 size-4" />
                Todas as conversas
              </Button>
            )}
            <Button variant="outline" onClick={lock}>
              Bloquear acesso
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bloqueio automático após 5 minutos ou ao ocultar a aba. Acesso somente para leitura.
          </p>
          {pair && <h3 className="font-semibold">{pair.title}</h3>}
          {busy && <p role="status">Carregando…</p>}
          {!busy && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada.</p>
          )}
          <div className="space-y-2">
            {items.map((item) =>
              pair ? (
                <article key={item.id} className="rounded-xl border p-3">
                  <p className="text-xs font-semibold">
                    {item.sender_name} → {item.recipient_name}
                  </p>
                  <p className="my-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                    {item.body}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </time>
                </article>
              ) : (
                <button
                  key={item.id}
                  disabled={busy}
                  className="block w-full rounded-xl border p-4 text-left hover:bg-secondary"
                  onClick={() =>
                    load({
                      a: item.sender_id,
                      b: item.recipient_id,
                      title: `${item.sender_name} e ${item.recipient_name}`,
                    })
                  }
                >
                  <span className="block font-medium">
                    {item.sender_name} e {item.recipient_name}
                  </span>
                  <time className="text-xs text-muted-foreground">
                    Última mensagem: {new Date(item.created_at).toLocaleString("pt-BR")}
                  </time>
                </button>
              ),
            )}
          </div>
          {more && (
            <Button disabled={busy} variant="outline" onClick={() => load(pair, true)}>
              Carregar anteriores
            </Button>
          )}
        </>
      )}
    </section>
  );
}
