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
        .select("id,name,email,total_points,status,created_at")
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
        (statusFilter === "all" || p.status === statusFilter),
    )
    .sort((a, b) =>
      sort === "points"
        ? b.total_points - a.total_points
        : sort === "recent"
          ? b.created_at.localeCompare(a.created_at)
          : a.name.localeCompare(b.name, "pt-BR"),
    );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Usuários do evento</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <strong>{people.length}</strong>
            <p className="text-sm">Cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <strong>{people.filter((p) => p.status === "active").length}</strong>
            <p className="text-sm">Ativos</p>
          </CardContent>
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
          Situação{" "}
          <select
            className="rounded border bg-background p-2"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todas</option>
            {[...new Set(people.map((p) => p.status))].map((s) => (
              <option key={s} value={s}>
                {s === "active" ? "Ativo" : s === "blocked" ? "Bloqueado" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Ordenar{" "}
          <select
            className="rounded border bg-background p-2"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="name">Nome A–Z</option>
            <option value="points">Mais pontos</option>
            <option value="recent">Mais recentes</option>
          </select>
        </label>
      </div>
      {isPending && <p role="status">Carregando usuários…</p>}
      {isError && (
        <p role="alert">
          Não foi possível carregar os usuários. Atualize a página para tentar novamente.
        </p>
      )}
      <p className="text-sm text-muted-foreground">{filtered.length} usuário(s) encontrado(s)</p>
      {visible.map((p) => {
        const draft = drafts[p.id] ?? { points: "", reason: "" };
        return (
          <Card key={p.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <span className="font-bold">{p.total_points} pts</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.status === "active" ? "Ativo" : p.status} · Cadastro:{" "}
                {new Date(p.created_at).toLocaleDateString("pt-BR")}
              </p>
              <details>
                <summary className="cursor-pointer text-sm font-medium">Ajustar pontuação</summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
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
                      adjust.mutate({
                        id: p.id,
                        points: Number(draft.points),
                        reason: draft.reason,
                      })
                    }
                  >
                    Aplicar
                  </Button>
                </div>
              </details>
            </CardContent>
          </Card>
        );
      })}
      {!isPending && !isError && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum participante encontrado.</p>
      )}
      {filtered.length > pageSize && (
        <nav aria-label="Páginas de usuários" className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span>
            {currentPage + 1} / {Math.ceil(filtered.length / pageSize)}
          </span>
          <Button
            variant="outline"
            disabled={(currentPage + 1) * pageSize >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
    </div>
  );
}
