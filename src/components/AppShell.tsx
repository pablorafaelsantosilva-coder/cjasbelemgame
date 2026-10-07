import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Home, Trophy, Images, User, Shield, LogOut, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppearanceToggle } from "@/components/AppearanceToggle";
import { toast } from "sonner";
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
  const [online, setOnline] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
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
      const { data, error } = await supabase.rpc("deliver_my_challenge_reminders");
      if (!error && data && typeof data === "object" && !Array.isArray(data)) {
        if (typeof data["delivered"] === "number" && data["delivered"] > 0) {
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          void queryClient.invalidateQueries({ queryKey: ["challenge-reminder", userId] });
          toast.info("Você tem um lembrete de desafio!", {
            action: {
              label: "Ver",
              onClick: () => {
                void navigate({ to: "/notificacoes" });
              },
            },
          });
        }
        if (typeof data["unread"] === "number") return data["unread"];
      }
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      return count ?? 0;
    },
  });

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await queryClient.cancelQueries();
      queryClient.clear();
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-card focus:p-3"
      >
        Pular para o conteúdo
      </a>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-r from-primary/50 via-background/80 to-primary/50"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-background/35 via-background/55 to-background/90"
      />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <Link to="/dashboard" className="flex items-center gap-2" aria-label="Ir para o início">
            <img
              src={logoAsset.url}
              alt="Aproxime-se de Cristo"
              className="h-9 w-14 shrink-0 object-contain sm:w-auto"
            />
            <span className="hidden text-sm font-semibold leading-tight sm:block">
              CJAS Belém
              <span className="block text-xs font-normal text-muted-foreground">Game</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-0 sm:gap-1">
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/admin" aria-label="Painel da organização">
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
            <AppearanceToggle />
            <Link to="/perfil" className="ml-1" aria-label="Meu perfil">
              <Avatar className="size-9 border border-border">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? ""} />
                <AvatarFallback>{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              disabled={leaving}
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-5">
        {!online && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-warning/40 bg-card p-3 text-sm"
          >
            Você está sem conexão. O conteúdo pode estar desatualizado. Aguarde a internet voltar
            antes de enviar.
          </div>
        )}
        {children}
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] border-t border-border bg-background/95 backdrop-blur"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "rounded-xl px-4 py-1 transition-colors",
                    active && "bg-primary/10",
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
