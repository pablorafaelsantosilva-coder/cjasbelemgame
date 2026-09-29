import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { MediaGallery } from "@/components/MediaGallery";

export const Route = createFileRoute("/_authenticated/memorias")({
  head: () => ({
    meta: [
      { title: "Minhas memórias — CJAS Belém Game" },
      { name: "description", content: "Galeria com todas as fotos e vídeos que você enviou durante o evento." },
      { property: "og:title", content: "Minhas memórias — CJAS Belém Game" },
      { property: "og:description", content: "Galeria com suas fotos e vídeos do evento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoriesPage,
});

function MemoriesPage() {
  const { userId } = useSession();
  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ["my-files", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission_files")
        .select("id,storage_path,file_type,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Minhas memórias</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível carregar suas memórias.</p>}
      {!isLoading && !isError && files.length === 0 && (
        <p className="text-sm text-muted-foreground">Você ainda não enviou fotos ou vídeos.</p>
      )}
      <MediaGallery files={files} />
    </div>
  );
}
