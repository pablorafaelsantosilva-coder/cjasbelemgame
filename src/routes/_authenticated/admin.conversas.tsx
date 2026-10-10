import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck, RefreshCw } from "lucide-react";
import { reviewPrivateMessages } from "@/lib/admin-chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/conversas")({
  head: () => ({ meta: [
    { title: "Revisão de conversas — CJAS Belém Game" },
    { name: "description", content: "Consulta protegida de conversas pela organização do CJAS Belém Game." },
    { property: "og:title", content: "Revisão de conversas — CJAS Belém Game" },
    { property: "og:description", content: "Área restrita de revisão de conversas da organização." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: ConversationReview,
});

type Result = Awaited<ReturnType<typeof reviewPrivateMessages>>;

function ConversationReview() {
  const review = useServerFn(reviewPrivateMessages);
  const password = useRef("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [participant, setParticipant] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; password.current = ""; };
  }, []);
  function lock() {
    password.current = "";
    setResult(null);
    setError("");
    setSearch("");
    setParticipant(null);
  }
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(lock, 10 * 60_000);
    return () => clearTimeout(timer);
  }, [result]);

  async function load(before: Result["next"] = null, person: string | null = participant) {
    setBusy(true);
    setError("");
    try {
      const page = await review({ data: { password: password.current, participant: person, before } });
      if (!alive.current) return;
      setResult((old) => before && old ? {
        ...page,
        messages: [...old.messages, ...page.messages],
        names: [...new Map([...old.names, ...page.names].map((p) => [p.id, p])).values()],
      } : page);
    } catch (e) {
      if (!alive.current) return;
      password.current = "";
      setResult(null);
      setError(e instanceof Error ? e.message : "Não foi possível abrir as conversas.");
    } finally { if (alive.current) setBusy(false); }
  }
  const names = new Map(result?.names.map((p) => [p.id, p.name]));
  const filtered = result?.messages.filter((m) => !search ||
    `${names.get(m.sender_id) ?? ""} ${names.get(m.recipient_id) ?? ""} ${m.body}`
      .toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) ?? [];

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="size-5 text-primary" />Conversas privadas</h2>
      {result && <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw />Atualizar</Button>
        <Button variant="secondary" disabled={busy} onClick={lock}><LockKeyhole />Bloquear</Button>
      </div>}
    </div>
    <p className="text-sm text-muted-foreground">Acesso exclusivo da administração, somente para leitura. Cada consulta fica registrada na auditoria.</p>
    {!result ? <form className="max-w-sm space-y-3 py-6" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      password.current = String(new FormData(form).get("password") ?? "");
      form.reset();
      void load();
    }}>
      <Label htmlFor="conversation-password">Senha de acesso</Label>
      <Input id="conversation-password" name="password" type="password" autoComplete="off" maxLength={128} required disabled={busy} />
      <Button type="submit" disabled={busy}><LockKeyhole />{busy ? "Verificando…" : "Abrir conversas"}</Button>
    </form> : <>
      <Input aria-label="Buscar nas mensagens carregadas" placeholder="Buscar nas mensagens carregadas…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {participant && <Button disabled={busy} variant="outline" onClick={() => { setParticipant(null); void load(null, null); }}>Todos os participantes</Button>}
      <div aria-live="polite" className="divide-y divide-border">
        {filtered.map((m) => <article key={m.id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Button disabled={busy} variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => { setParticipant(m.sender_id); void load(null, m.sender_id); }}>{names.get(m.sender_id) ?? "Participante"}</Button>
              <span className="text-muted-foreground">→</span>
              <Button disabled={busy} variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => { setParticipant(m.recipient_id); void load(null, m.recipient_id); }}>{names.get(m.recipient_id) ?? "Participante"}</Button>
            </div>
            <time className="text-xs text-muted-foreground" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("pt-BR")}</time>
          </div>
          {m.reply_to_id && <p className="text-xs text-muted-foreground">Resposta a uma mensagem</p>}
          <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{m.body}</p>
        </article>)}
        {!filtered.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem encontrada.</p>}
      </div>
      {result.next && <Button variant="outline" disabled={busy} onClick={() => void load(result.next)}>{busy ? "Carregando…" : "Mensagens anteriores"}</Button>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}