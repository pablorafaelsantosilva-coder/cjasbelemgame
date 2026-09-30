import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

function ChatPage() {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryKey = ["chat-messages"];

  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
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
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("cjas-chat-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error("Entre na sua conta para conversar.");
      const { error } = await supabase.from("chat_messages").insert({ author_id: userId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const hide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_messages").update({ hidden: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mensagem ocultada."); queryClient.invalidateQueries({ queryKey }); },
    onError: () => toast.error("Não foi possível ocultar a mensagem."),
  });

  const messages = (data?.pages.flat() ?? []).filter((message) => !message.hidden).reverse();
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><MessageCircle className="size-5" /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Conversa geral</h1>
          <p className="text-sm text-muted-foreground">CJAS Belém Game · Todos os participantes</p>
        </div>
      </div>

      <div className="flex min-h-[50vh] flex-col rounded-lg border border-border bg-card/90 shadow-soft">
        <div className="flex-1 space-y-5 px-4 py-6 sm:px-6" aria-live="polite" aria-label="Mensagens da conversa">
          {hasNextPage && (
            <div className="text-center"><Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>{isFetchingNextPage ? "Carregando…" : "Ver mensagens anteriores"}</Button></div>
          )}
          {isPending && <p className="text-center text-sm text-muted-foreground">Carregando conversa…</p>}
          {isError && <div className="text-center"><p className="text-sm text-destructive">Não foi possível abrir a conversa.</p><Button variant="ghost" size="sm" onClick={() => refetch()}>Tentar novamente</Button></div>}
          {!isPending && !isError && messages.length === 0 && (
            <div className="flex min-h-[32vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MessageCircle className="size-8 text-primary" />
              <p className="font-medium text-foreground">A conversa começa aqui</p>
              <p className="text-sm">Seja a primeira pessoa a deixar uma mensagem.</p>
            </div>
          )}
          {messages.map((message) => {
            const mine = message.author_id === userId;
            return (
              <div key={message.id} className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                <Avatar className="size-8 shrink-0"><AvatarFallback className="bg-secondary text-xs text-secondary-foreground">{initials(message.author_name)}</AvatarFallback></Avatar>
                <div className={cn("min-w-0 max-w-[82%] space-y-1", mine && "text-right")}>
                  <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", mine && "justify-end")}>
                    <span className="truncate font-semibold text-foreground">{mine ? "Você" : message.author_name}</span>
                    <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                    {isAdmin && <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" aria-label={`Ocultar mensagem de ${message.author_name}`} title="Ocultar mensagem" disabled={hide.isPending} onClick={() => hide.mutate(message.id)}><Trash2 className="size-3.5" /></Button>}
                  </div>
                  <p className={cn("inline-block max-w-full whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-left text-sm leading-relaxed", mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{message.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form className="sticky bottom-16 flex items-end gap-2 border-t border-border bg-card p-3 sm:static sm:p-4" onSubmit={(event) => { event.preventDefault(); const text = draft.trim(); if (text && !send.isPending) send.mutate(text); }}>
          <Textarea aria-label="Escrever mensagem" placeholder="Escreva sua mensagem…" maxLength={500} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} className="min-h-12 max-h-32 resize-none" />
          <Button type="submit" size="icon" className="size-12 shrink-0" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!draft.trim() || send.isPending || !profile || profile.status !== "active"}><Send className="size-5" /></Button>
        </form>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-4" />A organização pode ocultar mensagens inadequadas.</p>
    </div>
  );
}