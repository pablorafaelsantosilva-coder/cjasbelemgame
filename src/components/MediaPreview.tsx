import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function MediaPreview({
  path,
  fileType,
  className,
  url,
  onRetry,
  loading = false,
}: {
  path: string;
  fileType: string;
  className?: string;
  url?: string | undefined;
  onRetry?: () => Promise<unknown>;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const video = fileType.startsWith("video") || /\.(mp4|mov|webm|m4v)(?:\?|$)/i.test(path);
  const failed = !!url && failedUrl === url;
  async function retry() {
    setRetrying(true);
    try {
      await onRetry?.();
      setFailedUrl(null);
    } finally {
      setRetrying(false);
    }
  }
  if (!url || failed)
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg bg-muted p-3 text-center text-xs",
          className,
        )}
      >
        <p role="status">
          {loading
            ? "Carregando mídia…"
            : failed
              ? "Este navegador não conseguiu exibir o arquivo."
              : "Arquivo indisponível ou link expirado."}
        </p>
        {!loading && onRetry && (
          <Button size="sm" variant="outline" disabled={retrying} onClick={retry}>
            {retrying ? "Atualizando…" : "Tentar novamente"}
          </Button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            Abrir arquivo original
          </a>
        )}
      </div>
    );
  return (
    <div className="min-w-0 space-y-1">
      {video ? (
        <video
          key={url}
          src={url}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailedUrl(url)}
          className={cn("rounded-lg bg-black object-contain", className)}
        />
      ) : (
        <button
          type="button"
          aria-label="Abrir foto em tela cheia"
          onClick={() => setOpen(true)}
          className="block w-full cursor-zoom-in"
        >
          <img
            src={url}
            alt="Comprovação enviada"
            loading="lazy"
            onError={() => setFailedUrl(url)}
            className={cn("rounded-lg bg-muted object-contain", className)}
          />
        </button>
      )}
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Tela cheia
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none gap-2 rounded-none border-0 bg-background p-4 sm:rounded-none">
          <DialogTitle className="pr-8">Comprovação enviada</DialogTitle>
          <DialogDescription>
            Visualização completa. Use o link abaixo para abrir ou ampliar o original.
          </DialogDescription>
          <div className="flex min-h-0 items-center justify-center overflow-auto">
            {video ? (
              <video
                src={url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[75dvh] max-w-full object-contain"
              />
            ) : (
              <img
                src={url}
                alt="Comprovação em tamanho completo"
                className="max-h-[75dvh] max-w-full object-contain"
              />
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-sm underline"
          >
            Abrir arquivo original
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}
