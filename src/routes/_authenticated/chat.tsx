import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  Check,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldCheck,
  Smile,
  Trash2,
  Reply,
  X,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import mountains from "@/assets/montanhas.jpg.asset.json";
import logo from "@/assets/logo-cristo.png.asset.json";
import { getSharedChatMedia } from "@/lib/chat-media.functions";
import { PrivateChat, type ChatPeer } from "@/components/chat/PrivateChat";
import type { ReplyDraft } from "@/components/chat/ChatComposer";
import { MediaPreview } from "@/components/MediaPreview";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Mensagens — CJAS Belém Game" },
      { name: "description", content: "Converse com os participantes do CJAS Belém Game." },
      { property: "og:title", content: "Mensagens — CJAS Belém Game" },
      { property: "og:description", content: "Conversa dos participantes do CJAS Belém Game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatHub,
});

const PAGE_SIZE = 40;
const CHAT_KEY = ["chat-messages"] as const;
const EMOJI_GROUPS = [
  {
    name: "Expressões",
    items: ["😀", "😂", "🥰", "😍", "😊", "😎", "🥹", "😮", "😭", "🤗", "😉", "😇"],
  },
  {
    name: "Reações",
    items: ["❤️", "🧡", "💛", "🙌", "👏", "👍", "🔥", "✨", "🎉", "💪", "🙏", "🫶"],
  },
  {
    name: "Encontro",
    items: ["⛪", "📖", "🌟", "🏆", "🎯", "📸", "🎶", "🌄", "☀️", "💬", "👋", "🤝"],
  },
];

function ChatHub() {
  const { userId } = useSession();
  const [tab, setTab] = useState<"general" | "private">("general");
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Mensagens</h1>
          <p className="text-xs text-muted-foreground">Encontre pessoas. Compartilhe momentos.</p>
        </div>
        <div
          className="flex gap-1 rounded-full bg-secondary p-1"
          role="tablist"
          aria-label="Tipo de conversa"
        >
          <button
            id="general-chat-tab"
            role="tab"
            aria-selected={tab === "general"}
            aria-controls="general-chat-panel"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm",
              tab === "general" && "bg-card font-semibold shadow-sm",
            )}
            onClick={() => setTab("general")}
          >
            <MessageCircle className="size-4" />
            Geral
          </button>
          <button
            id="private-chat-tab"
            role="tab"
            aria-selected={tab === "private"}
            aria-controls="private-chat-panel"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm",
              tab === "private" && "bg-card font-semibold shadow-sm",
            )}
            onClick={() => setTab("private")}
          >
            <LockKeyhole className="size-4" />
            Privadas
          </button>
        </div>
      </div>
      <div
        id="general-chat-panel"
        role="tabpanel"
        aria-labelledby="general-chat-tab"
        hidden={tab !== "general"}
      >
        <GeneralChat
          key={`general-${userId}`}
          active={tab === "general"}
          onPrivate={(person) => {
            setPeer(person);
            setTab("private");
          }}
        />
      </div>
      <div
        id="private-chat-panel"
        role="tabpanel"
        aria-labelledby="private-chat-tab"
        hidden={tab !== "private"}
      >
        <PrivateChat
          key={`private-${userId}`}
          active={tab === "private"}
          peer={peer}
          onPeer={setPeer}
        />
      </div>
    </div>
  );
}

function GeneralChat({
  active,
  onPrivate,
}: {
  active: boolean;
  onPrivate: (peer: ChatPeer) => void;
}) {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<ReplyDraft | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [live, setLive] = useState(false);
  const queryClient = useQueryClient();
  const fetchSharedMedia = useServerFn(getSharedChatMedia);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const restoreRef = useRef<number | null>(null);

  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [...CHAT_KEY, userId],
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) => {
        let query = supabase
          .from("chat_messages")
          .select("id,author_id,author_name,body,hidden,created_at,reply_to_id")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);
        if (pageParam) query = query.lt("created_at", pageParam);
        const { data: rows, error } = await query;
        if (error) throw error;
        return rows ?? [];
      },
      getNextPageParam: (lastPage) =>
        lastPage.length === PAGE_SIZE
          ? (lastPage[lastPage.length - 1]?.created_at ?? undefined)
          : undefined,
      enabled: !!userId && active,
      refetchInterval: live ? 60_000 : 20_000,
      refetchIntervalInBackground: false,
    });

  const {
    data: sharedData,
    isError: mediaError,
    hasNextPage: hasOlderMedia,
    fetchNextPage: fetchOlderMedia,
    isFetchingNextPage: fetchingOlderMedia,
    refetch: refetchMedia,
  } = useInfiniteQuery({
    queryKey: ["chat-shared-media", userId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchSharedMedia({ data: { before: pageParam } }),
    getNextPageParam: (lastPage) =>
      lastPage.rows.length === 40 ? lastPage.rows[lastPage.rows.length - 1]?.created_at : undefined,
    enabled: !!userId && active,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId || !active) return;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refresh) return;
      refresh = setTimeout(() => {
        refresh = undefined;
        void queryClient.invalidateQueries({ queryKey: CHAT_KEY });
      }, 1500);
    };
    const refreshModeration = () => {
      scheduleRefresh();
      void queryClient.invalidateQueries({ queryKey: ["chat-replies"] });
    };
    const channel = supabase
      .channel("cjas-chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        refreshModeration,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(refresh);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient, active]);

  const send = useMutation({
    mutationFn: async ({ body, replyId }: { body: string; replyId: string | null }) => {
      if (!userId) throw new Error("Entre na sua conta para conversar.");
      const { error } = await supabase
        .from("chat_messages")
        .insert({ author_id: userId, body, reply_to_id: replyId });
      if (error) throw error;
    },
    onSuccess: (_result, { body, replyId }) => {
      setReply((current) => (current?.id === replyId ? null : current));
      setDraft((current) => (current === body ? "" : current));
      atBottomRef.current = true;
      void queryClient.invalidateQueries({ queryKey: CHAT_KEY });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_messages").update({ hidden: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem ocultada.");
      void queryClient.invalidateQueries({ queryKey: CHAT_KEY });
      void queryClient.invalidateQueries({ queryKey: ["chat-replies"] });
    },
    onError: () => toast.error("Não foi possível ocultar a mensagem."),
  });

  const hideMedia = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("submission_chat_shares")
        .update({ hidden: true })
        .eq("submission_id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mídia ocultada do chat.");
      void queryClient.invalidateQueries({ queryKey: ["chat-shared-media"] });
    },
    onError: () => toast.error("Não foi possível ocultar a mídia."),
  });

  const messages = (data?.pages.flat() ?? []).filter((message) => !message.hidden).reverse();
  const quoteIds = [
    ...new Set(messages.flatMap((m) => (m.reply_to_id ? [m.reply_to_id] : []))),
  ].sort();
  const quotes = useQuery({
    queryKey: ["chat-replies", userId, quoteIds.join("|")],
    enabled: active && !!userId && quoteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,author_name,body")
        .in("id", quoteIds)
        .eq("hidden", false);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
  const quoteMap = new Map(quotes.data?.map((q) => [q.id, q]));
  const sharedMedia =
    sharedData?.pages.flatMap((page) => page.rows.map((row) => ({ ...row, urls: page.urls }))) ??
    [];
  const timeline = [
    ...messages.map((message) => ({
      kind: "text" as const,
      item: message,
      created_at: message.created_at,
      id: message.id,
    })),
    ...sharedMedia.map((item) => ({
      kind: "media" as const,
      item,
      created_at: item.created_at,
      id: item.submission_id,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const newestId = timeline[timeline.length - 1]?.id;
  const pageCount = (data?.pages.length ?? 0) + (sharedData?.pages.length ?? 0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!active || !list || !data) return;
    if (restoreRef.current !== null) {
      list.scrollTop = list.scrollHeight - restoreRef.current;
      restoreRef.current = null;
    } else if (!initialScrollRef.current || atBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      initialScrollRef.current = true;
      setShowJump(false);
    }
  }, [newestId, pageCount, data, active]);

  function jumpToLatest() {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setShowJump(false);
  }

  function addEmoji(emoji: string) {
    const input = textareaRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > 500) return;
    setDraft(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function loadOlder() {
    const list = listRef.current;
    if (list) restoreRef.current = list.scrollHeight - list.scrollTop;
    const oldestText = messages[0]?.created_at;
    const oldestMedia = sharedMedia[sharedMedia.length - 1]?.created_at;
    if (
      hasNextPage &&
      (!hasOlderMedia || !oldestMedia || (oldestText && oldestText <= oldestMedia))
    )
      void fetchNextPage();
    else if (hasOlderMedia) void fetchOlderMedia();
  }

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex h-[calc(100dvh-17rem)] min-h-96 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lift sm:h-[calc(100dvh-14rem)]">
        <header className="z-10 flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-soft sm:px-5">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary">
            <img src={logo.url} alt="" className="h-full w-full object-contain p-1" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">
              Anda com Cristo
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Conversa geral · CJAS Belém Game
            </p>
          </div>
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
            title="Todos os participantes"
            aria-label="Todos os participantes"
          >
            <MessageCircle className="size-4" />
          </span>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${mountains.url})` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-background/85 dark:bg-background/80"
          />
          <div
            ref={listRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              atBottomRef.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 90;
              setShowJump(!atBottomRef.current);
            }}
            className="relative h-full space-y-4 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6"
            aria-label="Mensagens da conversa"
            role="log"
            aria-live="polite"
          >
            {(hasNextPage || hasOlderMedia) && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetchingNextPage || fetchingOlderMedia}
                  onClick={loadOlder}
                >
                  {isFetchingNextPage || fetchingOlderMedia
                    ? "Carregando…"
                    : "Ver mensagens anteriores"}
                </Button>
              </div>
            )}
            {isPending && (
              <p className="text-center text-sm text-muted-foreground">Carregando conversa…</p>
            )}
            {isError && (
              <div className="text-center">
                <p className="text-sm text-destructive">
                  Não foi possível abrir a conversa. Se esta atualização é recente, confirme a
                  migração do banco com a organização.
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {mediaError && (
              <div className="text-center">
                <p className="text-sm text-destructive">
                  Não foi possível abrir as mídias compartilhadas.
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetchMedia()}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {!isPending && !isError && !mediaError && timeline.length === 0 && (
              <div className="flex min-h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <span className="grid size-14 place-items-center rounded-full bg-secondary">
                  <MessageCircle className="size-7 text-primary" />
                </span>
                <p className="font-semibold text-foreground">A conversa começa aqui</p>
                <p className="text-sm">Seja a primeira pessoa a deixar uma mensagem.</p>
              </div>
            )}
            {timeline.map((entry, index) => {
              const mine = entry.item.author_id === userId;
              const previous = timeline[index - 1];
              const date = new Date(entry.created_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const previousDate =
                previous &&
                new Date(previous.created_at).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
              const grouped =
                entry.kind === "text" &&
                previous?.kind === "text" &&
                previous.item.author_id === entry.item.author_id &&
                previousDate === date &&
                new Date(entry.created_at).getTime() - new Date(previous.created_at).getTime() <
                  300_000;
              return (
                <div
                  id={`general-message-${entry.id}`}
                  key={`${entry.kind}-${entry.id}`}
                  className={cn("flex flex-col", grouped && "!-mt-2")}
                >
                  {date !== previousDate && (
                    <div className="my-4 text-center">
                      <time
                        className="inline-block rounded-md border border-border bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-sm"
                        dateTime={entry.created_at}
                      >
                        {date}
                      </time>
                    </div>
                  )}
                  <div className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                    {grouped ? (
                      <span className="size-8 shrink-0" aria-hidden="true" />
                    ) : (
                      <Avatar className="size-8 shrink-0 border border-border">
                        <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                          {initials(entry.item.author_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 max-w-[83%] sm:max-w-[75%]">
                      <div className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "min-w-0 rounded-lg border px-3 py-2 shadow-soft",
                            mine
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card/95 text-card-foreground",
                            !grouped && (mine ? "rounded-br-sm" : "rounded-bl-sm"),
                          )}
                        >
                          {!grouped && (
                            <button
                              type="button"
                              disabled={mine}
                              title={mine ? "Sua mensagem" : "Conversar no privado"}
                              onClick={() =>
                                onPrivate({
                                  id: entry.item.author_id,
                                  name: entry.item.author_name,
                                  avatar_url: null,
                                  active: true,
                                })
                              }
                              className={cn(
                                "mb-1 block max-w-full truncate text-xs font-bold",
                                mine
                                  ? "text-primary-foreground/90"
                                  : "text-primary hover:underline",
                              )}
                            >
                              {mine ? "Você" : entry.item.author_name}
                            </button>
                          )}
                          {entry.kind === "text" && entry.item.reply_to_id && (
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
                                  `general-message-${entry.item.reply_to_id}`,
                                );
                                if (target)
                                  target.scrollIntoView({ block: "center", behavior: "smooth" });
                                else toast.info("A mensagem original está no histórico anterior.");
                              }}
                            >
                              <p className="text-xs font-semibold">
                                {quoteMap.get(entry.item.reply_to_id)?.author_name ??
                                  "Mensagem original"}
                              </p>
                              <p className="line-clamp-2 break-words text-xs opacity-80">
                                {quoteMap.get(entry.item.reply_to_id)?.body ??
                                  (quotes.isPending ? "Carregando…" : "Mensagem indisponível")}
                              </p>
                            </button>
                          )}
                          {entry.kind === "text" ? (
                            <p className="whitespace-pre-wrap break-words text-left text-sm leading-relaxed">
                              {entry.item.body}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-medium">
                                Desafio: {entry.item.challenge_title}
                              </p>
                              <div
                                className={cn(
                                  "grid gap-1",
                                  entry.item.file_paths.length > 1 && "grid-cols-2",
                                )}
                              >
                                {entry.item.file_paths.map((path, fileIndex) => (
                                  <MediaPreview
                                    key={entry.item.file_ids[fileIndex] ?? path}
                                    path={path}
                                    fileType={entry.item.file_types[fileIndex] ?? "image/unknown"}
                                    url={entry.item.urls[path]}
                                    onRetry={() => refetchMedia()}
                                    className="aspect-square w-full max-w-52"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          <time
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums",
                              mine ? "text-primary-foreground/75" : "text-muted-foreground",
                            )}
                            dateTime={entry.created_at}
                          >
                            {new Date(entry.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {mine && <Check className="size-3" aria-label="Enviada" />}
                          </time>
                        </div>
                        {entry.kind === "text" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground"
                            aria-label={`Responder à mensagem de ${entry.item.author_name}`}
                            title="Responder"
                            onClick={() => {
                              setReply({
                                id: entry.item.id,
                                name: mine ? "Você" : entry.item.author_name,
                                body: entry.item.body,
                              });
                              textareaRef.current?.focus();
                            }}
                          >
                            <Reply className="size-3.5" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Ocultar ${entry.kind === "text" ? "mensagem" : "mídia"} de ${entry.item.author_name}`}
                            title="Ocultar do chat"
                            disabled={hide.isPending}
                            onClick={() => {
                              if (entry.kind === "text") hide.mutate(entry.item.id);
                              else hideMedia.mutate(entry.item.submission_id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {showJump && timeline.length > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-4 right-4 z-10 size-10 rounded-full border border-border shadow-lift"
              aria-label="Ir para mensagens mais recentes"
              title="Mais recentes"
              onClick={jumpToLatest}
            >
              <ArrowDown className="size-4" />
            </Button>
          )}
        </div>

        <form
          className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-5 sm:py-3"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (text && !send.isPending && profile?.status === "active")
              send.mutate({ body: text, replyId: reply?.id ?? null });
          }}
        >
          {reply && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-primary bg-secondary/70 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-primary">
                  Respondendo a {reply.name}
                </p>
                <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                  {reply.body}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancelar resposta"
                onClick={() => setReply(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-background p-1.5 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring sm:gap-2">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted-foreground hover:text-primary"
                  aria-label="Escolher emoji"
                  title="Escolher emoji"
                >
                  <Smile className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                className="w-[min(19rem,calc(100vw-2rem))] p-3"
              >
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {EMOJI_GROUPS.map((group) => (
                    <div key={group.name}>
                      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                        {group.name}
                      </p>
                      <div className="grid grid-cols-6 gap-1">
                        {group.items.map((emoji) => (
                          <Button
                            key={emoji}
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10 text-xl"
                            title={emoji}
                            aria-label={`Inserir emoji ${emoji}`}
                            onClick={() => addEmoji(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Textarea
              ref={textareaRef}
              aria-label="Escrever mensagem"
              placeholder="Escreva sua mensagem…"
              maxLength={500}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-h-10 max-h-32 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-base shadow-none focus-visible:ring-0 md:text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0 rounded-full press-in"
              aria-label="Enviar mensagem"
              title="Enviar mensagem"
              disabled={!draft.trim() || send.isPending || !profile || profile.status !== "active"}
            >
              {send.isPending ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <ShieldCheck className="size-3.5 shrink-0" />
              Conversa moderada pela organização
            </span>
            <span
              aria-label={`${draft.length} de 500 caracteres`}
              className="shrink-0 tabular-nums"
            >
              {draft.length}/500
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
