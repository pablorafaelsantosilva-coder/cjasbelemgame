import { useQuery } from "@tanstack/react-query";
import { signedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function MediaPreview({
  path,
  fileType,
  className,
}: {
  path: string;
  fileType: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["signed", path],
    staleTime: 50 * 60 * 1000,
    queryFn: () => signedUrl(path),
  });

  if (!url) {
    return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
  }

  if (fileType.startsWith("video")) {
    return <video src={url} controls className={cn("rounded-lg bg-black object-cover", className)} />;
  }

  return <img src={url} alt="Comprovação enviada" loading="lazy" className={cn("rounded-lg object-cover", className)} />;
}
