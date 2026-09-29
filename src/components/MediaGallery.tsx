import { useQuery } from "@tanstack/react-query";
import { signedUrls } from "@/lib/media";
import { MediaPreview } from "@/components/MediaPreview";

type FileItem = { id: string; storage_path: string; file_type: string };

export function MediaGallery({ files, columns = "grid-cols-2 gap-2 sm:grid-cols-3" }: { files: FileItem[]; columns?: string }) {
  const paths = files.map((f) => f.storage_path);
  const key = paths.join("|");
  const { data: urls = {}, isError } = useQuery({
    queryKey: ["signed-batch", key],
    queryFn: () => signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
  });
  return (
    <div className={`grid ${columns}`}>
      {isError && <p className="col-span-full text-sm text-destructive">Não foi possível abrir as comprovações.</p>}
      {files.map((f) => (
        <MediaPreview key={f.id} path={f.storage_path} fileType={f.file_type} url={urls[f.storage_path]} className="aspect-square w-full" />
      ))}
    </div>
  );
}