import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, Check, LoaderCircle, MessageCircle, Send, ShieldCheck, Smile, Trash2 } from "lucide-react";
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
import { MediaPreview } from "@/components/MediaPreview";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [
    { title: "Conversa geral — CJAS Belém Game" },
    { name: "description", content: "Converse com os participantes do CJAS Belém Game." },
    { property: "og:title", content: "Conversa geral — CJAS Belém Game" },
    { property: "og:description", content: "Conversa dos participantes do CJAS Belém Game." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatPage,
});

const PAGE_SIZE = 40;
const CHAT_KEY = ["chat-messages"] as const;
const EMOJI_GROUPS = [
  { name: "Expressões", items: ["😀", "😂", "🥰", "😍", "😊", "😎", "🥹", "😮", "😭", "🤗", "😉", "😇"] },
  { name: "Reações", items: ["❤️", "🧡", "💛", "🙌", "👏", "👍", "🔥", "✨", "🎉", "💪", "🙏", "🫶"] },
  { name: "Encontro", items: ["⛪", "📖", "🌟", "🏆", "🎯", "📸", "🎶", "🌄", "☀️", "💬", "👋", "🤝"] },
];

function ChatPage() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const queryClient = useQueryClient();
  const fetchSharedMedia = useServerFn(getSharedChatMedia);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const restoreRef = useRef<number | null>(null);

  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: CHAT_KEY,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = supabase.from("chat_messages")
        .select("id,author_id,author_name,body,hidden,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) query = query.lt("created_at", pageParam);
      const { data: rows, error } = await query;
      if (error) throw error;
      return rows ?? [];
    },
    getNextPageParam: (lastPage) => lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.created_at ?? undefined : undefined,
    enabled: !!userId,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
  });

  const { data: sharedData, isError: mediaError, hasNextPage: hasOlderMedia, fetchNextPage: fetchOlderMedia, isFetchingNextPage: fetchingOlderMedia, refetch: refetchMedia } = useInfiniteQuery({
    queryKey: ["chat-shared-media"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchSharedMedia({ data: { before: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.rows.length === 40 ? lastPage.rows[lastPage.rows.length - 1]?.created_at : undefined,
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId) return;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refresh);
      refresh = setTimeout(() => { void queryClient.invalidateQueries({ queryKey: CHAT_KEY }); void queryClient.invalidateQueries({ queryKey: ["chat-shared-media"] }); }, 350);
    };
    const channel = supabase.channel("cjas-chat-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, scheduleRefresh)
      .subscribe();
    return () => { clearTimeout(refresh); void supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error("Entre na sua conta para conversar.");
      const { error } = await supabase.from("chat_messages").insert({ author_id: userId, body });
      if (error) throw error;
    },
    onSuccess: (_result, body) => {
      setDraft((current) => current === body ? "" : current);
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
    onSuccess: () => { toast.success("Mensagem ocultada."); void queryClient.invalidateQueries({ queryKey: CHAT_KEY }); },
    onError: () => toast.error("Não foi possível ocultar a mensagem."),
  });

  const hideMedia = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase.from("submission_chat_shares").update({ hidden: true }).eq("submission_id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mídia ocultada do chat."); void queryClient.invalidateQueries({ queryKey: ["chat-shared-media"] }); },
    onError: () => toast.error("Não foi possível ocultar a mídia."),
  });

  const messages = (data?.pages.flat() ?? []).filter((message) => !message.hidden).reverse();
  const sharedMedia = sharedData?.pages.flatMap((page) => page.rows.map((row) => ({ ...row, urls: page.urls }))) ?? [];
  const timeline = [
    ...messages.map((message) => ({ kind: "text" as const, item: message, created_at: message.created_at, id: message.id })),
    ...sharedMedia.map((item) => ({ kind: "media" as const, item, created_at: item.created_at, id: item.submission_id })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const newestId = timeline[timeline.length - 1]?.id;
  const pageCount = (data?.pages.length ?? 0) + (sharedData?.pages.length ?? 0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !data) return;
    if (restoreRef.current !== null) {
      list.scrollTop = list.scrollHeight - restoreRef.current;
      restoreRef.current = null;
    } else if (!initialScrollRef.current || atBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      initialScrollRef.current = true;
      setShowJump(false);
    }
  }, [newestId, pageCount, data]);

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
    if (hasNextPage && (!hasOlderMedia || !oldestMedia || (oldestText && oldestText <= oldestMedia))) void fetchNextPage();
    else if (hasOlderMedia) void fetchOlderMedia();
  }

  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex h-[calc(100dvh-10.5rem)] min-h-96 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lift sm:h-[calc(100dvh-11rem)]">
        <header className="z-10 flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-soft sm:px-5">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary"><img src={logo.url} alt="" className="h-full w-full object-contain p-1" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">Anda com Cristo</h1>
            <p className="truncate text-xs text-muted-foreground">Conversa geral · CJAS Belém Game</p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary" title="Todos os participantes" aria-label="Todos os participantes"><MessageCircle className="size-4" /></span>
        </header>

        <div className="relative min-h-0 flex-1">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${mountains.url})` }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-background/85 dark:bg-background/80" />
          <div ref={listRef} onScroll={(event) => {
          const element = event.currentTarget;
          atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90;
          setShowJump(!atBottomRef.current);
          }} className="relative h-full space-y-4 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6" aria-label="Mensagens da conversa" role="log" aria-live="polite">
          {(hasNextPage || hasOlderMedia) && (
            <div className="text-center"><Button variant="outline" size="sm" disabled={isFetchingNextPage || fetchingOlderMedia} onClick={loadOlder}>{isFetchingNextPage || fetchingOlderMedia ? "Carregando…" : "Ver mensagens anteriores"}</Button></div>
          )}
          {isPending && <p className="text-center text-sm text-muted-foreground">Carregando conversa…</p>}
          {isError && <div className="text-center"><p className="text-sm text-destructive">Não foi possível abrir a conversa.</p><Button variant="ghost" size="sm" onClick={() => refetch()}>Tentar novamente</Button></div>}
          {mediaError && <div className="text-center"><p className="text-sm text-destructive">Não foi possível abrir as mídias compartilhadas.</p><Button variant="ghost" size="sm" onClick={() => refetchMedia()}>Tentar novamente</Button></div>}
          {!isPending && !isError && !mediaError && timeline.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <span className="grid size-14 place-items-center rounded-full bg-secondary"><MessageCircle className="size-7 text-primary" /></span>
              <p className="font-semibold text-foreground">A conversa começa aqui</p>
              <p className="text-sm">Seja a primeira pessoa a deixar uma mensagem.</p>
            </div>
          )}
          {timeline.map((entry, index) => {
            const mine = entry.item.author_id === userId;
            const previous = timeline[index - 1];
            const date = new Date(entry.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
            const previousDate = previous && new Date(previous.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
            const grouped = entry.kind === "text" && previous?.kind === "text" && previous.item.author_id === entry.item.author_id && previousDate === date && new Date(entry.created_at).getTime() - new Date(previous.created_at).getTime() < 300_000;
            return (
              <div key={`${entry.kind}-${entry.id}`} className={cn("flex flex-col", grouped && "!-mt-2")}>
                {date !== previousDate && <div className="my-4 text-center"><time className="inline-block rounded-md border border-border bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-soft backdrop-blur-sm" dateTime={entry.created_at}>{date}</time></div>}
                <div className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                  {grouped ? <span className="size-8 shrink-0" aria-hidden="true" /> : <Avatar className="size-8 shrink-0 border border-border"><AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials(entry.item.author_name)}</AvatarFallback></Avatar>}
                  <div className="min-w-0 max-w-[83%] sm:max-w-[75%]">
                    <div className={cn("flex items-end gap-1.5", mine && "flex-row-reverse")}>
                      <div className={cn("min-w-0 rounded-lg border px-3 py-2 shadow-soft", mine ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95 text-card-foreground", !grouped && (mine ? "rounded-br-sm" : "rounded-bl-sm"))}>
                        {!grouped && <p className={cn("mb-1 truncate text-xs font-bold", mine ? "text-primary-foreground/90" : "text-primary")}>{mine ? "Você" : entry.item.author_name}</p>}
                        {entry.kind === "text" ? <p className="whitespace-pre-wrap break-words text-left text-sm leading-relaxed">{entry.item.body}</p> : <div className="space-y-2"><p className="text-xs font-medium">Desafio: {entry.item.challenge_title}</p><div className={cn("grid gap-1", entry.item.file_paths.length > 1 && "grid-cols-2")}>{entry.item.file_paths.map((path, fileIndex) => <MediaPreview key={entry.item.file_ids[fileIndex] ?? path} path={path} fileType={entry.item.file_types[fileIndex] ?? "image/unknown"} url={entry.item.urls[path]} className="aspect-square w-full max-w-52" />)}</div></div>}
                        <time className={cn("mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums", mine ? "text-primary-foreground/75" : "text-muted-foreground")} dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{mine && <Check className="size-3" aria-label="Enviada" />}</time>
                      </div>
                      {isAdmin && <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Ocultar ${entry.kind === "text" ? "mensagem" : "mídia"} de ${entry.item.author_name}`} title="Ocultar do chat" disabled={hide.isPending} onClick={() => { if (entry.kind === "text") hide.mutate(entry.item.id); else hideMedia.mutate(entry.item.submission_id); }}><Trash2 className="size-3.5" /></Button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          {showJump && timeline.length > 0 && <Button variant="secondary" size="icon" className="absolute bottom-4 right-4 z-10 size-10 rounded-full border border-border shadow-lift" aria-label="Ir para mensagens mais recentes" title="Mais recentes" onClick={jumpToLatest}><ArrowDown className="size-4" /></Button>}
        </div>

        <form className="shrink-0 border-t border-border bg-card px-3 py-2.5 sm:px-5 sm:py-3" onSubmit={(event) => { event.preventDefault(); const text = draft.trim(); if (text && !send.isPending && profile?.status === "active") send.mutate(text); }}>
          <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-background p-1.5 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring sm:gap-2">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground hover:text-primary" aria-label="Escolher emoji" title="Escolher emoji"><Smile className="size-5" /></Button></PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-[min(19rem,calc(100vw-2rem))] p-3">
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {EMOJI_GROUPS.map((group) => <div key={group.name}><p className="mb-1.5 text-xs font-semibold text-muted-foreground">{group.name}</p><div className="grid grid-cols-6 gap-1">{group.items.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="icon" className="size-10 text-xl" title={emoji} aria-label={`Inserir emoji ${emoji}`} onClick={() => addEmoji(emoji)}>{emoji}</Button>)}</div></div>)}
                </div>
              </PopoverContent>
            </Popover>
            <Textarea ref={textareaRef} aria-label="Escrever mensagem" placeholder="Escreva sua mensagem…" maxLength={500} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} className="min-h-10 max-h-32 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-base shadow-none focus-visible:ring-0 md:text-sm" />
            <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full press-in" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!draft.trim() || send.isPending || !profile || profile.status !== "active"}>{send.isPending ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}</Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><ShieldCheck className="size-3.5 shrink-0" />Conversa moderada pela organização</span>
            <span aria-label={`${draft.length} de 500 caracteres`} className="shrink-0 tabular-nums">{draft.length}/500</span>
          </div>
        </form>
      </div>
    </div>
  );
}