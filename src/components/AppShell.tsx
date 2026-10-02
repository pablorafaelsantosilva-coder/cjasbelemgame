import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Home, Trophy, Images, User, Shield, LogOut, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo-cristo.png.asset.json";
import bgAsset from "@/assets/montanhas.jpg.asset.json";

const navItems = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/memorias", label: "Memórias", icon: Images },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const { data: profile } = useProfile(userId);
  const { data: isAdmin } = useIsAdmin(userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      return count ?? 0;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative isolate min-h-screen pb-24">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-r from-primary/50 via-background/80 to-primary/50" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-background/35 via-background/55 to-background/90" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2" aria-label="Ir para o início">
            <img src={logoAsset.url} alt="Aproxime-se de Cristo" className="h-9 w-auto" />
            <span className="hidden text-sm font-semibold leading-tight sm:block">
              CJAS Belém
              <span className="block text-xs font-normal text-muted-foreground">Game</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/admin">
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">Painel</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link to="/notificacoes" aria-label="Notificações">
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            </Button>
            <Link to="/perfil" className="ml-1">
              <Avatar className="size-9 border border-border">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? ""} />
                <AvatarFallback>{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
