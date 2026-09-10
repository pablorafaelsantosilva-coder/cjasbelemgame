import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — CJAS Belém Game" },
      { name: "description", content: "Histórico de todas as ações realizadas pela organização durante o evento." },
      { property: "og:title", content: "Auditoria — CJAS Belém Game" },
      { property: "og:description", content: "Histórico de ações da organização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAudit,
});

function AdminAudit() {
  const { data: logs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-2">
      {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>}
      {logs.map((l) => (
        <Card key={l.id}>
          <CardContent className="space-y-1 p-3 text-sm">
            <p className="font-medium">{l.action}</p>
            <p className="text-xs text-muted-foreground">
              {l.entity_type ?? "—"} · {formatDateTime(l.created_at)}
            </p>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(l.details, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
