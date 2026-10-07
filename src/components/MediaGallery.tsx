import { useQuery } from "@tanstack/react-query";
import { signedUrls } from "@/lib/media";
import { useSession } from "@/hooks/useAuth";
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
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["signed-batch", userId, paths],
    queryFn: () => signedUrls(paths),
    enabled: !!userId && paths.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: "always",
    retry: 1,
  });
  return (
    <div className={`grid ${columns}`}>
      {isError && (
        <p role="alert" className="col-span-full text-sm text-destructive">
          Falha ao carregar as mídias. Tente novamente.
        </p>
      )}
      {files.length === 0 && (
        <p className="col-span-full text-sm text-muted-foreground">
          Nenhum arquivo anexado a este envio.
        </p>
      )}
      {files.map((f) => (
        <MediaPreview
          key={f.id}
          path={f.storage_path}
          fileType={f.file_type}
          url={urls[f.storage_path]}
          loading={isFetching}
          onRetry={() => {
            void refetch();
          }}
          className="aspect-square w-full"
        />
      ))}
    </div>
  );
}
