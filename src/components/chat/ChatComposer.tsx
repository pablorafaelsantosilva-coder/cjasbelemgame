import { useRef, useState } from "react";
import { LoaderCircle, Send, Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ReplyDraft = { id: string; name: string; body: string };
export function ChatComposer({
  value,
  onChange,
  onSend,
  reply,
  onCancelReply,
  pending,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  reply: ReplyDraft | null;
  onCancelReply: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [emojis, setEmojis] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && !pending && value.trim()) onSend();
      }}
      className="shrink-0 border-t border-border bg-card p-3"
    >
      {reply && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-primary bg-secondary/70 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary">
              Respondendo a {reply.name}
            </p>
            <p className="line-clamp-2 break-words text-xs text-muted-foreground">{reply.body}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancelar resposta"
            onClick={onCancelReply}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-1 rounded-2xl border border-input bg-background p-1.5 focus-within:ring-1 focus-within:ring-primary">
        <Popover open={emojis} onOpenChange={setEmojis}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Escolher emoji">
              <Smile className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="grid w-60 grid-cols-6 gap-1" align="start" side="top">
            {[
              "😀",
              "😂",
              "🥰",
              "😊",
              "😎",
              "🤗",
              "❤️",
              "🙌",
              "👏",
              "👍",
              "🔥",
              "✨",
              "🎉",
              "🙏",
              "🫶",
              "📸",
              "👋",
              "🤝",
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded-lg p-1.5 text-xl hover:bg-secondary"
                aria-label={`Inserir ${emoji}`}
                onClick={() => {
                  const start = input.current?.selectionStart ?? value.length;
                  const end = input.current?.selectionEnd ?? start;
                  const next = value.slice(0, start) + emoji + value.slice(end);
                  if (next.length <= 2000) onChange(next);
                  setEmojis(false);
                  requestAnimationFrame(() => {
                    input.current?.focus();
                    input.current?.setSelectionRange(start + emoji.length, start + emoji.length);
                  });
                }}
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Textarea
          ref={input}
          aria-label="Mensagem privada"
          placeholder={disabled ? "Conversa indisponível para envio" : "Escreva uma mensagem…"}
          rows={1}
          maxLength={2000}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label="Enviar mensagem privada"
          disabled={disabled || pending || !value.trim()}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      <p className="mt-1 text-right text-[10px] text-muted-foreground">
        {value.length}/2000 · Shift + Enter para nova linha
      </p>
    </form>
  );
}
