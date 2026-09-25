import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useIsAdmin, useSession } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel Admin — CJAS Belém Game" },
      { name: "description", content: "Área administrativa da organização do evento." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Visão geral", exact: true },
  { to: "/admin/validacoes", label: "Validações" },
  { to: "/admin/desafios", label: "Desafios" },
  { to: "/admin/participantes", label: "Participantes" },
  { to: "/admin/configuracoes", label: "Configurações" },
  { to: "/admin/auditoria", label: "Auditoria" },
] as {
  to:
    | "/admin"
    | "/admin/validacoes"
    | "/admin/desafios"
    | "/admin/participantes"
    | "/admin/configuracoes"
    | "/admin/auditoria";
  label: string;
  exact?: boolean;
}[];

function AdminLayout() {
  const { userId } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin(userId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <div className="py-10 text-center">
        <p className="font-semibold">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Esta área é exclusiva da organização do evento.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Painel da organização</h1>
      <nav aria-label="Abas de administração" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-none">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
