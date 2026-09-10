import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — CJAS Belém Game" },
      { name: "description", content: "Defina uma nova senha para sua conta do CJAS Belém Game." },
      { property: "og:title", content: "Redefinir senha — CJAS Belém Game" },
      { property: "og:description", content: "Defina uma nova senha para sua conta do CJAS Belém Game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("A senha precisa de ao menos 6 caracteres."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center sand-gradient px-4">
      <form onSubmit={submit} className="surface w-full max-w-sm space-y-3 p-6">
        <h1 className="text-lg font-semibold">Definir nova senha</h1>
        <div className="space-y-1.5">
          <Label htmlFor="np">Nova senha</Label>
          <Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          Salvar senha
        </Button>
      </form>
    </div>
  );
}
