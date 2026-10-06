import { useState } from "react";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryFeedback } from "@/components/QueryFeedback";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { MediaGallery } from "@/components/MediaGallery";

export const Route = createFileRoute("/_authenticated/memorias")({
  head: () => ({
    meta: [
      { title: "Minhas memórias — CJAS Belém Game" },
      {
        name: "description",
        content: "Galeria com todas as fotos e vídeos que você enviou durante o evento.",
      },
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
  const {
    data: files = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [limit, setLimit] = useState(24);
  const selected = files.filter(
    (file) => filter === "all" || file.file_type.startsWith(`${filter}/`),
  );
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <Images className="mb-3 size-7 text-primary" />
        <h1 className="text-2xl font-bold">Minhas memórias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus registros, suas histórias. Relembre cada momento.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {files.filter((file) => file.file_type.startsWith("image/")).length} fotos ·{" "}
          {files.filter((file) => file.file_type.startsWith("video/")).length} vídeos
        </p>
      </section>
      <div className="flex gap-2" role="group" aria-label="Filtrar memórias">
        {(
          [
            { value: "all", label: "Tudo" },
            { value: "image", label: "Fotos" },
            { value: "video", label: "Vídeos" },
          ] as const
        ).map((item) => (
          <Button
            key={item.value}
            variant={filter === item.value ? "default" : "outline"}
            className="rounded-full"
            size="sm"
            aria-pressed={filter === item.value}
            onClick={() => {
              setFilter(item.value);
              setLimit(24);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {isError && (
        <QueryFeedback
          message="Não foi possível carregar suas memórias."
          onRetry={() => {
            void refetch();
          }}
        />
      )}
      {!isLoading && !isError && files.length === 0 && (
        <p className="text-sm text-muted-foreground">Você ainda não enviou fotos ou vídeos.</p>
      )}
      {selected.length > 0 && <MediaGallery files={selected.slice(0, limit)} />}
      {!isLoading && !isError && files.length > 0 && selected.length === 0 && (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Nenhum registro neste filtro ainda.
        </p>
      )}
      {selected.length > limit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLimit((value) => value + 24)}
        >
          Carregar mais memórias
        </Button>
      )}
    </div>
  );
}
