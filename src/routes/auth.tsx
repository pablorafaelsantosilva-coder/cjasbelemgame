import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import bgAsset from "@/assets/cjas-tema.png.asset.json";
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

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

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
    if (!data.session) {
      toast.success("Conta criada! Confirme o e-mail para entrar.");
      setTab("login");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
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
      <div className="absolute inset-0 bg-background/85 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src={logoAsset.url} alt="Aproxime-se de Cristo — Ele é o caminho" className="mx-auto w-52" />
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
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continuar com Google
          </Button>
          <Button variant="outline" className="mt-2 w-full" onClick={handleApple}>
            Continuar com Apple
          </Button>
        </div>
      </div>
    </div>
  );
}
