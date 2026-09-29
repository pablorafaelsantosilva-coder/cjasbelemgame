import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SparkCelebration } from "@/components/SparkCelebration";
import bgAsset from "@/assets/montanhas.jpg.asset.json";
import logoAsset from "@/assets/logo-cristo.png.asset.json";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — CJAS Belém Game" },
      { name: "description", content: "Acesse sua conta de participante do CJAS Belém Game ou crie uma nova." },
      { property: "og:title", content: "Entrar — CJAS Belém Game" },
      { property: "og:description", content: "Acesse sua conta de participante do CJAS Belém Game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passSchema = z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(72);

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-4">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9.1h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.6z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M16.36 12.78c.02-2.13 1.74-3.15 1.82-3.2-1-1.46-2.54-1.66-3.09-1.68-1.31-.13-2.57.77-3.24.77-.67 0-1.7-.75-2.8-.73-1.44.02-2.77.84-3.51 2.13-1.5 2.6-.38 6.44 1.07 8.55.71 1.03 1.55 2.19 2.66 2.15 1.07-.04 1.47-.69 2.77-.69 1.29 0 1.66.69 2.79.67 1.15-.02 1.88-1.05 2.58-2.09.81-1.2 1.15-2.36 1.17-2.42-.03-.01-2.24-.86-2.22-3.46zM14.3 5.6c.59-.72.99-1.71.88-2.7-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.64-.9 2.61.95.07 1.92-.48 2.51-1.19z" />
    </svg>
  );
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const { session } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState(mode === "signup" ? "signup" : "login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (session && !celebrating) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate, celebrating]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
    setLoading(false);
    if (error) { toast.error("Não foi possível entrar. Verifique e-mail e senha."); return; }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) { toast.error(parsedEmail.error.issues[0]!.message); return; }
    const parsedPass = passSchema.safeParse(password);
    if (!parsedPass.success) { toast.error(parsedPass.error.issues[0]!.message); return; }
    if (name.trim().length < 2) { toast.error("Informe seu nome completo."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.data,
      password,
      options: { emailRedirectTo: window.location.origin, data: { name: name.trim() } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setCelebrating(true);
    if (!data.session) {
      window.setTimeout(() => {
        setCelebrating(false);
        toast.success("Conta criada! Confirme o e-mail para entrar.");
        setTab("login");
      }, 2200);
      return;
    }
    window.setTimeout(() => navigate({ to: "/dashboard", replace: true }), 2200);
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) { toast.error("Não foi possível entrar com o Google."); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleApple() {
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) { toast.error("Não foi possível entrar com a Apple."); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleRecover() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("Informe seu e-mail para recuperar a senha."); return; }
    setRecovering(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setRecovering(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <div
      className="relative grid min-h-screen place-items-center bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: `url(${bgAsset.url})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/55 via-background/75 to-primary/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/50 to-background/90 backdrop-blur-[1px]" />
      {celebrating && <SparkCelebration label="Conta criada!" />}
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <Link to="/" aria-label="Voltar à tela inicial" className="inline-block">
            <img src={logoAsset.url} alt="Aproxime-se de Cristo — Ele é o caminho" className="mx-auto w-52" />
          </Link>
          <h1 className="mt-3 text-2xl font-bold">CJAS Belém Game</h1>
          <p className="text-sm text-muted-foreground">Entre para ver seus desafios</p>
        </div>

        <div className="surface p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="space-y-3 pt-4" onSubmit={handleLogin}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={handleRecover}
                  disabled={recovering}
                  className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-3 pt-4" onSubmit={handleSignup}>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">E-mail</Label>
                  <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pass2">Senha</Label>
                  <Input
                    id="pass2"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={handleGoogle}>
            <GoogleIcon />
            Continuar com Google
          </Button>
          <Button variant="outline" className="mt-2 w-full gap-2" onClick={handleApple}>
            <AppleIcon />
            Continuar com Apple
          </Button>
        </div>
      </div>
    </div>
  );
}
