import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isVideo } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function MediaPreview({
  path,
  fileType,
  className,
  url,
  loading = false,
  onRetry,
}: {
  path: string;
  fileType: string;
  className?: string;
  url?: string | undefined;
  loading?: boolean;
  onRetry?: (() => void) | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const video = isVideo(fileType, path);
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
              : "Mídia indisponível ou link expirado."}
        </p>
        {!loading && onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFailed(false);
              onRetry();
            }}
          >
            Tentar novamente
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
    <>
      <div className="space-y-1">
        {video ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            className={cn("rounded-lg bg-black object-contain", className)}
          />
        ) : (
          <button
            type="button"
            aria-label="Abrir foto em tela cheia"
            className="block w-full cursor-zoom-in"
            onClick={() => {
              setZoom(false);
              setOpen(true);
            }}
          >
            <img
              src={url}
              alt="Comprovação enviada"
              loading="lazy"
              onError={() => setFailed(true)}
              className={cn("rounded-lg object-contain bg-muted", className)}
            />
          </button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            setZoom(false);
            setOpen(true);
          }}
        >
          Ampliar {video ? "vídeo" : "foto"}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!h-[100dvh] !w-screen !max-w-none !rounded-none border-0 bg-background p-4 sm:p-6">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <DialogTitle>Comprovação em tela cheia</DialogTitle>
            <DialogDescription>Confira todos os detalhes antes de validar.</DialogDescription>
            <div className="flex gap-3">
              {!video && (
                <Button size="sm" variant="outline" onClick={() => setZoom(!zoom)}>
                  {zoom ? "Ajustar à tela" : "Zoom 2×"}
                </Button>
              )}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                Abrir original
              </a>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-black">
              {video ? (
                <video
                  src={url}
                  controls
                  playsInline
                  autoPlay
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={url}
                  alt="Comprovação ampliada"
                  className={zoom ? "w-[200%] max-w-none" : "h-full w-full object-contain"}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
