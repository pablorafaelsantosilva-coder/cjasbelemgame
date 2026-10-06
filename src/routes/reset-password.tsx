import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, clearPendingEmail } from "@/lib/auth-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Redefinir senha — CJAS Belém Game" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    const expired =
      new URLSearchParams(window.location.hash.slice(1)).has("error") ||
      new URLSearchParams(window.location.search).has("error");
    if (expired) {
      setErrorMessage(
        "Este link expirou ou já foi utilizado. Solicite outro em Esqueci minha senha.",
      );
      setChecking(false);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setValid(true);
        setChecking(false);
        setErrorMessage("");
      }
    });
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!alive) return;
        setValid(!error && !!data.user);
        setChecking(false);
        if (error || !data.user)
          setErrorMessage(
            "Abra o link enviado ao seu e-mail. Se ele expirou, solicite outro em Esqueci minha senha.",
          );
      })
      .catch(() => {
        if (alive) {
          setChecking(false);
          setErrorMessage(
            "Não foi possível validar o link. Confira sua conexão e recarregue a página.",
          );
        }
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !valid) return;
    setErrorMessage("");
    if (password.length < 6 || password.length > 72) {
      setErrorMessage("Use uma senha de 6 a 72 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("As senhas não são iguais. Digite novamente.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      clearPendingEmail();
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (error) {
      setErrorMessage(
        authErrorMessage(
          error,
          "Não foi possível salvar. O link pode ter expirado; solicite uma nova recuperação.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid min-h-screen place-items-center sand-gradient px-4">
      <section className="surface w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold">{done ? "Senha atualizada!" : "Definir nova senha"}</h1>
        {checking && (
          <p role="status" className="text-sm">
            Verificando seu link…
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {done ? (
          <>
            <p role="status" className="text-sm">
              Sua nova senha foi salva com sucesso.
            </p>
            <Button asChild className="w-full">
              <Link to="/dashboard">Continuar para o evento</Link>
            </Button>
          </>
        ) : (
          valid && (
            <form onSubmit={submit} className="space-y-3">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Label htmlFor="confirm-password">Repita a nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={72}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          )
        )}
        {!done && (
          <Link to="/auth" className="block text-center text-sm font-medium text-primary underline">
            Voltar ao login / pedir outro link
          </Link>
        )}
      </section>
    </div>
  );
}
