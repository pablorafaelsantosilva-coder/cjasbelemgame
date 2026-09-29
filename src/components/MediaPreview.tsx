import { cn } from "@/lib/utils";

export function MediaPreview({
  path,
  fileType,
  className,
  url,
}: {
  path: string;
  fileType: string;
  className?: string;
  url?: string | undefined;
}) {
  if (!url) {
    return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
  }

  if (fileType.startsWith("video")) {
    return <video src={url} controls preload="none" className={cn("rounded-lg bg-foreground object-cover", className)} />;
  }

  return <img src={url} alt="Comprovação enviada" loading="lazy" className={cn("rounded-lg object-cover", className)} />;
}
