import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — CJAS Belém Game" },
      {
        name: "description",
        content: "Avisos sobre validações, novos desafios e mensagens da organização.",
      },
      { property: "og:title", content: "Notificações — CJAS Belém Game" },
      { property: "og:description", content: "Avisos sobre validações e novos desafios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!userId || items.length === 0) return;
    const unread = items.filter((i) => !i.read).map((i) => i.id);
    if (unread.length === 0) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unread)
      .then(() => queryClient.invalidateQueries({ queryKey: ["unread", userId] }));
  }, [items, userId, queryClient]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notificações</h1>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
      )}
      <div className="space-y-2">
        {items.map((n) => (
          <Card key={n.id} className={cn(!n.read && "border-primary/40 bg-primary/5")}>
            <CardContent className="space-y-1 p-4">
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              {n.challenge_id && (
                <Link
                  to="/desafio/$id"
                  params={{ id: n.challenge_id }}
                  className="inline-block py-2 text-sm font-semibold text-primary underline"
                >
                  Ver desafio
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
