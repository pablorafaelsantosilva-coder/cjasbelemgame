import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  LockKeyhole,
  MessageCircle,
  MessageSquarePlus,
  Reply,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatComposer, type ReplyDraft } from "./ChatComposer";
import { useChatDrafts } from "@/hooks/useChatDrafts";
import { ChatSearch } from "./ChatSearch";
import { cn } from "@/lib/utils";
import mountains from "@/assets/montanhas.jpg.asset.json";

export type ChatPeer = { id: string; name: string; avatar_url: string | null; active: boolean };
type Cursor = { created_at: string; id: string } | null;
type Draft = { text: string; reply: ReplyDraft | null };
const EMPTY: Draft = { text: "", reply: null };
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();

export function PrivateChat({
  active,
  peer,
  onPeer,
}: {
  active: boolean;
  peer: ChatPeer | null;
  onPeer: (peer: ChatPeer | null) => void;
}) {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [newConversation, setNewConversation] = useState(false);
  const [drafts, setDrafts] = useChatDrafts(userId);
  const [showJump, setShowJump] = useState(false);
  const [live, setLive] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const restore = useRef<number | null>(null);
  const peerRef = useRef(peer?.id);
  peerRef.current = peer?.id;
  const draftKey = `${userId}:${peer?.id}`;
  const draft = drafts[draftKey] ?? EMPTY;
  function patchDraft(patch: Partial<Draft>) {
    setDrafts((old) => ({ ...old, [draftKey]: { ...(old[draftKey] ?? EMPTY), ...patch } }));
  }
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    nearBottom.current = true;
    restore.current = null;
    setShowJump(false);
  }, [peer?.id]);

  const inbox = useQuery({
    queryKey: ["direct-inbox", userId],
    enabled: !!userId && active,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_direct_inbox");
      if (error) throw error;
      return data;
    },
    refetchInterval: live ? 60_000 : 20_000,
  });
  const missingSetup = [inbox.error].some(
    (error) =>
      error && ["PGRST202", "PGRST205", "42P01"].includes((error as { code?: string }).code ?? ""),
  );
  const directoryOpen =
    newConversation || !!term || (!inbox.isPending && !inbox.isError && inbox.data?.length === 0);
  const people = useQuery({
    queryKey: ["chat-people", userId, term],
    enabled: !!userId && active && directoryOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chat_people", { _search: term, _limit: 100 });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
  const thread = useInfiniteQuery({
    queryKey: ["direct-messages", userId, peer?.id],
    enabled: !!userId && !!peer && active,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("direct_messages")
        .select("id,sender_id,recipient_id,body,reply_to_id,created_at")
        .in("sender_id", [userId!, peer!.id])
        .in("recipient_id", [userId!, peer!.id])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(40);
      if (pageParam)
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (page) =>
      page.length === 40 ? { created_at: page[39]!.created_at, id: page[39]!.id } : undefined,
    refetchInterval: live ? 60_000 : 20_000,
  });
  const messages = [
    ...new Map((thread.data?.pages.flat() ?? []).map((m) => [m.id, m])).values(),
  ].reverse();
  const replyIds = [
    ...new Set(messages.flatMap((m) => (m.reply_to_id ? [m.reply_to_id] : []))),
  ].sort();
  const replies = useQuery({
    queryKey: ["direct-replies", userId, peer?.id, replyIds.join("|")],
    enabled: active && !!userId && replyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("id,sender_id,body")
        .in("id", replyIds);
      if (error) throw error;
      return data;
    },
  });
  const replyMap = new Map(replies.data?.map((m) => [m.id, m]));
  const lastId = messages.at(-1)?.id;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!active || !list || !thread.data) return;
    if (restore.current !== null) {
      list.scrollTop = list.scrollHeight - restore.current;
      restore.current = null;
    } else if (nearBottom.current) list.scrollTop = list.scrollHeight;
  }, [active, peer?.id, lastId, thread.data]);

  useEffect(() => {
    if (!userId || !active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changedPeers = new Set<string>();
    const refresh = (payload: { new: Record<string, unknown> }) => {
      const other =
        payload.new["sender_id"] === userId
          ? payload.new["recipient_id"]
          : payload.new["sender_id"];
      if (typeof other === "string") changedPeers.add(other);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void queryClient.invalidateQueries({ queryKey: ["direct-inbox", userId] });
        for (const peerId of changedPeers) {
          void queryClient.invalidateQueries({
            queryKey: ["direct-messages", userId, peerId],
            exact: true,
          });
        }
        changedPeers.clear();
      }, 250);
    };
    const channel = supabase
      .channel(`direct-chat-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${userId}`,
        },
        refresh,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [active, userId, queryClient]);

  const send = useMutation({
    mutationFn: async (payload: {
      recipient: string;
      text: string;
      reply: ReplyDraft | null;
      key: string;
    }) => {
      if (!userId) throw new Error("Entre novamente para enviar.");
      const { error } = await supabase.from("direct_messages").insert({
        sender_id: userId,
        recipient_id: payload.recipient,
        body: payload.text.trim(),
        reply_to_id: payload.reply?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_result, payload) => {
      setDrafts((old) => {
        const current = old[payload.key] ?? EMPTY;
        return {
          ...old,
          [payload.key]: {
            text: current.text === payload.text ? "" : current.text,
            reply: current.reply?.id === payload.reply?.id ? null : current.reply,
          },
        };
      });
      if (peerRef.current === payload.recipient) nearBottom.current = true;
      void queryClient.invalidateQueries({
        queryKey: ["direct-messages", userId, payload.recipient],
      });
      void queryClient.invalidateQueries({ queryKey: ["direct-inbox", userId] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Não foi possível enviar. Seu rascunho foi mantido."),
  });
  const currentPeer = inbox.data?.find((item) => item.peer_id === peer?.id);
  const recipientActive = currentPeer?.peer_active ?? peer?.active ?? false;
  function choose(next: ChatPeer) {
    onPeer(next);
    setNewConversation(false);
    setSearch("");
  }

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[26rem] sm:h-[calc(100dvh-14rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-border md:w-72",
          peer && "hidden md:flex",
        )}
      >
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Suas conversas</h2>
            <Button
              size="sm"
              variant="default"
              aria-label="Nova conversa"
              aria-expanded={directoryOpen}
              onClick={() => setNewConversation(!newConversation)}
            >
              <MessageSquarePlus className="mr-1.5 size-4" />
              Adicionar pessoas
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Conversas entre participantes. Administradores autorizados podem revisar as mensagens para moderação.</p>
          {newConversation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewConversation(false);
                setSearch("");
              }}
            >
              Voltar às conversas
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              aria-label="Buscar participante"
              placeholder="Buscar participante…"
              value={search}
              maxLength={80}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {missingSetup && (
          <div role="status" className="space-y-2 border-b bg-warning/10 p-4 text-sm">
            <p className="font-semibold">O chat privado ainda precisa ser ativado.</p>
            <p className="text-xs">
              A organização precisa concluir a configuração. Depois disso, você poderá escolher uma
              pessoa e enviar uma mensagem.
            </p>
            {isAdmin && (
              <p className="break-words text-xs">
                No Lovable, aplique a migração{" "}
                <code className="break-all">20261006033000_private_chat_and_replies.sql</code> e
                verifique novamente no Painel → Visão geral.
              </p>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {directoryOpen ? (
            <>
              <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Escolha uma pessoa do evento
              </p>
              {people.isPending && <p className="p-3 text-sm">Buscando participantes…</p>}
              {people.isError && (
                <div role="alert" className="space-y-2 p-3 text-sm">
                  <p>
                    Não foi possível buscar participantes. Verifique a conexão ou tente novamente.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => people.refetch()}>
                    Buscar novamente
                  </Button>
                </div>
              )}
              {people.data?.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => choose({ ...p, active: true })}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary"
                >
                  <Avatar>
                    <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(p.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                </button>
              ))}
              {people.data?.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhum participante encontrado.</p>
              )}
              {(people.data?.length ?? 0) >= 100 && (
                <p className="p-3 text-xs text-muted-foreground">
                  Digite um nome para encontrar mais participantes.
                </p>
              )}
            </>
          ) : (
            <>
              {inbox.isPending && <p className="p-3 text-sm">Carregando conversas…</p>}
              {inbox.isError && (
                <div className="space-y-2 p-3 text-sm">
                  <p className="text-destructive">
                    As conversas privadas estão temporariamente indisponíveis. Você pode continuar
                    no chat Geral.
                  </p>
                  <Button variant="outline" onClick={() => inbox.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {inbox.data?.map((item) => (
                <button
                  key={item.peer_id}
                  type="button"
                  onClick={() =>
                    choose({
                      id: item.peer_id,
                      name: item.peer_name,
                      avatar_url: item.peer_avatar_url,
                      active: item.peer_active,
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-secondary",
                    peer?.id === item.peer_id && "bg-primary/10",
                  )}
                >
                  <Avatar>
                    <AvatarImage src={item.peer_avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(item.peer_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {item.peer_name}
                      </p>
                      <time className="text-[10px] text-muted-foreground">
                        {new Date(item.last_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.last_sender_id === userId ? "Você: " : ""}
                      {item.last_body}
                    </p>
                  </div>
                </button>
              ))}
              {inbox.data?.length === 0 && (
                <div className="space-y-3 p-5 text-center text-sm text-muted-foreground">
                  <MessageCircle className="mx-auto size-9 text-primary/60" />
                  <p>Encontre alguém do evento e comece uma conversa.</p>
                  <Button variant="outline" onClick={() => setNewConversation(true)}>
                    Nova conversa
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
      {peer ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card p-3">
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              aria-label="Voltar às conversas"
              onClick={() => onPeer(null)}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <Avatar>
              <AvatarImage src={peer.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{initials(peer.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{peer.name}</h2>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <LockKeyhole className="size-3" />
                Conversa entre participantes · sujeita à revisão da organização
              </p>
            </div>
          </header>
          <ChatSearch
            key={peer.id}
            live={live}
            items={messages.map((message) => ({
              id: `private-message-${message.id}`,
              text: message.body,
            }))}
          />
          <div className="relative min-h-0 flex-1 bg-secondary/30">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08]"
              style={{ backgroundImage: `url(${mountains.url})` }}
            />
            <div
              ref={listRef}
              role="log"
              aria-label={`Mensagens com ${peer.name}`}
              aria-live="polite"
              onScroll={(e) => {
                const el = e.currentTarget;
                nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
                setShowJump(!nearBottom.current);
              }}
              className="relative h-full space-y-3 overflow-y-auto overscroll-contain p-4"
            >
              {thread.hasNextPage && (
                <div className="text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={thread.isFetchingNextPage}
                    onClick={async () => {
                      const el = listRef.current;
                      if (el) restore.current = el.scrollHeight - el.scrollTop;
                      await thread.fetchNextPage();
                    }}
                  >
                    {thread.isFetchingNextPage ? "Carregando…" : "Mensagens anteriores"}
                  </Button>
                </div>
              )}
              {thread.isPending && <p className="text-center text-sm">Carregando mensagens…</p>}
              {thread.isError && (
                <div className="text-center text-sm">
                  <p>Não foi possível abrir a conversa.</p>
                  <Button variant="ghost" onClick={() => thread.refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {!thread.isPending && !thread.isError && messages.length === 0 && (
                <div className="grid min-h-full place-content-center gap-2 text-center text-sm text-muted-foreground">
                  <LockKeyhole className="mx-auto size-8 text-primary/50" />
                  <p>Diga um oi para {peer.name.split(" ")[0]}.</p>
                  <p className="text-xs">As mensagens ficam entre vocês no aplicativo.</p>
                </div>
              )}
              {messages.map((m, index) => {
                const mine = m.sender_id === userId;
                const quoted = m.reply_to_id ? replyMap.get(m.reply_to_id) : undefined;
                const day = new Date(m.created_at).toLocaleDateString("pt-BR");
                const previousDay =
                  messages[index - 1] &&
                  new Date(messages[index - 1]!.created_at).toLocaleDateString("pt-BR");
                return (
                  <div key={m.id} id={`private-message-${m.id}`} className="scroll-mt-4">
                    {day !== previousDay && (
                      <div className="mb-4 text-center">
                        <span className="rounded-full bg-card/90 px-3 py-1 text-[10px] text-muted-foreground">
                          {day}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn("flex items-end gap-1", mine ? "justify-end" : "justify-start")}
                    >
                      {mine && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          aria-label={`Responder à mensagem: ${m.body.slice(0, 35)}`}
                          onClick={() =>
                            patchDraft({ reply: { id: m.id, body: m.body, name: "Você" } })
                          }
                        >
                          <Reply className="size-3.5" />
                        </Button>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 shadow-sm",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card",
                        )}
                      >
                        {m.reply_to_id && (
                          <button
                            type="button"
                            className={cn(
                              "mb-2 block w-full rounded-lg border-l-2 p-2 text-left",
                              mine
                                ? "border-primary-foreground/60 bg-primary-foreground/10"
                                : "border-primary bg-secondary",
                            )}
                            onClick={() => {
                              const target = document.getElementById(
                                `private-message-${m.reply_to_id}`,
                              );
                              if (target)
                                target.scrollIntoView({ block: "center", behavior: "smooth" });
                              else toast.info("A mensagem original está no histórico anterior.");
                            }}
                          >
                            <p className="text-xs font-semibold">
                              {quoted
                                ? quoted.sender_id === userId
                                  ? "Você"
                                  : peer.name
                                : "Mensagem original"}
                            </p>
                            <p className="line-clamp-2 break-words text-xs opacity-80">
                              {quoted?.body ??
                                (replies.isPending ? "Carregando…" : "Mensagem indisponível")}
                            </p>
                          </button>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                          {m.body}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                          <time dateTime={m.created_at}>
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          {mine && <Check className="size-3" aria-label="Enviada" />}
                        </div>
                      </div>
                      {!mine && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          aria-label={`Responder à mensagem: ${m.body.slice(0, 35)}`}
                          onClick={() =>
                            patchDraft({ reply: { id: m.id, body: m.body, name: peer.name } })
                          }
                        >
                          <Reply className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {showJump && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-3 right-3 rounded-full shadow-lg"
                aria-label="Mensagens mais recentes"
                onClick={() => {
                  listRef.current?.scrollTo({
                    top: listRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                  nearBottom.current = true;
                  setShowJump(false);
                }}
              >
                <ArrowDown className="size-4" />
              </Button>
            )}
          </div>
          <ChatComposer
            value={draft.text}
            onChange={(text) => patchDraft({ text })}
            reply={draft.reply}
            onCancelReply={() => patchDraft({ reply: null })}
            error={
              send.isError && send.variables?.recipient === peer.id
                ? "Não foi possível enviar. Seu texto foi mantido; tente novamente."
                : undefined
            }
            pending={send.isPending}
            disabled={profile?.status !== "active" || !recipientActive || thread.isError}
            onSend={() =>
              send.mutate({
                recipient: peer.id,
                text: draft.text,
                reply: draft.reply,
                key: draftKey,
              })
            }
          />
        </section>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground md:flex">
          <span className="rounded-3xl bg-primary/10 p-5">
            <MessageCircle className="size-10 text-primary" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Um espaço para conversar</h2>
          <p className="max-w-xs text-sm">
            Escolha uma conversa ou encontre um participante pelo nome.
          </p>
        </div>
      )}
    </div>
  );
}
