import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatSearch({
  items,
  live,
}: {
  items: { id: string; text: string }[];
  live: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [position, setPosition] = useState(0);
  const highlighted = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      highlighted.current?.classList.remove("chat-search-match");
    },
    [],
  );
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const matches = term.trim()
    ? items.filter((item) => normalize(item.text).includes(normalize(term.trim())))
    : [];
  const index = Math.min(position, Math.max(0, matches.length - 1));
  function reveal(next: number) {
    if (!matches.length) return;
    const bounded = (next + matches.length) % matches.length;
    setPosition(bounded);
    const element = document.getElementById(matches[bounded]!.id);
    if (!element) return;
    clearTimeout(timer.current);
    highlighted.current?.classList.remove("chat-search-match");
    highlighted.current = element;
    element.classList.add("chat-search-match");
    element.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    timer.current = setTimeout(() => element.classList.remove("chat-search-match"), 2000);
  }
  return (
    <div className="shrink-0 border-b bg-card px-3 py-1.5">
      {!open ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {live ? "Atualizações em tempo real" : "Atualização periódica"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Search className="mr-1.5 size-4" />
            Buscar nesta conversa
          </Button>
        </div>
      ) : (
        <>
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              reveal(index);
            }}
          >
            <Input
              autoFocus
              aria-label="Buscar nas mensagens carregadas"
              placeholder="Buscar mensagem…"
              value={term}
              maxLength={100}
              onChange={(event) => {
                setTerm(event.target.value);
                setPosition(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setTerm("");
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Resultado anterior"
              disabled={!matches.length}
              onClick={() => reveal(index - 1)}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Mostrar resultado"
              disabled={!matches.length}
            >
              <Search className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Próximo resultado"
              disabled={!matches.length}
              onClick={() => reveal(index + 1)}
            >
              <ChevronDown className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar busca"
              onClick={() => {
                setOpen(false);
                setTerm("");
              }}
            >
              <X className="size-4" />
            </Button>
          </form>
          <p role="status" className="mt-1 text-[10px] text-muted-foreground">
            {term.trim()
              ? matches.length
                ? `${index + 1} de ${matches.length} resultados`
                : "Nenhum resultado"
              : "Busca nas mensagens carregadas"}{" "}
            · Carregue mensagens anteriores para ampliar a busca.
          </p>
        </>
      )}
    </div>
  );
}
