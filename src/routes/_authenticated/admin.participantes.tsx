import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/participantes")({
  head: () => ({
    meta: [
      { title: "Participantes — CJAS Belém Game" },
      {
        name: "description",
        content: "Consulte participantes, ajuste pontos manualmente e acompanhe a pontuação.",
      },
      { property: "og:title", content: "Participantes — CJAS Belém Game" },
      { property: "og:description", content: "Consulte participantes e ajuste pontos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminParticipants,
});

function AdminParticipants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [drafts, setDrafts] = useState<Record<string, { points: string; reason: string }>>({});
  const queryClient = useQueryClient();

  const {
    data: people = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email,total_points,status")
        .order("total_points", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ id, points, reason }: { id: string; points: number; reason: string }) => {
      const { error } = await supabase.rpc("adjust_points", {
        _user_id: id,
        _points: points,
        _description: reason || "Ajuste manual da organização",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pontos ajustados.");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: () => toast.error("Não foi possível ajustar os pontos."),
  });

  const filtered = people
    .filter(
      (p) =>
        `${p.name} ${p.email ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()) &&
        (statusFilter === "all" ||
          (statusFilter === "active" ? p.status === "active" : p.status !== "active")),
    )
    .sort((a, b) =>
      sort === "points"
        ? b.total_points - a.total_points || a.name.localeCompare(b.name, "pt-BR")
        : a.name.localeCompare(b.name, "pt-BR"),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Usuários do evento</h2>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Card className="p-3">
          <strong className="block text-xl">{people.length}</strong>Cadastrados
        </Card>
        <Card className="p-3">
          <strong className="block text-xl">
            {people.filter((p) => p.status === "active").length}
          </strong>
          Ativos
        </Card>
        <Card className="p-3">
          <strong className="block text-xl">{filtered.length}</strong>Encontrados
        </Card>
      </div>
      <Input
        aria-label="Buscar usuários"
        placeholder="Buscar por nome ou e-mail"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Status{" "}
          <select
            className="rounded-md border bg-background p-2"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
        <label className="text-sm">
          Ordenar{" "}
          <select
            className="rounded-md border bg-background p-2"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="name">Nome A–Z</option>
            <option value="points">Maior pontuação</option>
          </select>
        </label>
      </div>
      {isPending && <p role="status">Carregando usuários…</p>}
      {isError && (
        <p role="alert" className="text-destructive">
          Não foi possível carregar os usuários.
        </p>
      )}
      {filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((p) => {
        const draft = drafts[p.id] ?? { points: "", reason: "" };
        return (
          <Card key={p.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </p>
                </div>
                <span className="font-bold">{p.total_points}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="number"
                  placeholder="Pontos (+/-)"
                  className="sm:w-36"
                  value={draft.points}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [p.id]: { ...draft, points: e.target.value } })
                  }
                />
                <Input
                  placeholder="Justificativa"
                  value={draft.reason}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [p.id]: { ...draft, reason: e.target.value } })
                  }
                />
                <Button
                  disabled={adjust.isPending || !draft.points}
                  onClick={() =>
                    adjust.mutate({ id: p.id, points: Number(draft.points), reason: draft.reason })
                  }
                >
                  Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {pageCount > 1 && (
        <nav aria-label="Páginas de usuários" className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            {currentPage + 1} de {pageCount}
          </span>
          <Button
            variant="outline"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
      {!isPending && !isError && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum participante encontrado.</p>
      )}
    </div>
  );
}
