import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/useAuth";
import { signedUrls } from "@/lib/media";
import { MediaPreview } from "@/components/MediaPreview";

type FileItem = { id: string; storage_path: string; file_type: string };

export function MediaGallery({
  files,
  columns = "grid-cols-2 gap-2 sm:grid-cols-3",
}: {
  files: FileItem[];
  columns?: string;
}) {
  const { userId } = useSession();
  const paths = files.map((f) => f.storage_path);
  const {
    data: urls = {},
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["signed-batch", userId, paths.join("|")],
    queryFn: () => signedUrls(paths),
    enabled: !!userId && paths.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: "always",
  });
  return (
    <div className={`grid ${columns}`}>
      {isError && (
        <p className="col-span-full text-sm text-destructive">
          Falha ao carregar os links. Tente novamente abaixo.
        </p>
      )}
      {files.length === 0 && (
        <p className="col-span-full text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
      )}
      {files.map((f) => (
        <MediaPreview
          key={f.id}
          path={f.storage_path}
          fileType={f.file_type}
          url={urls[f.storage_path]}
          loading={isFetching && !urls[f.storage_path]}
          onRetry={() => refetch()}
          className="aspect-square w-full"
        />
      ))}
    </div>
  );
}
