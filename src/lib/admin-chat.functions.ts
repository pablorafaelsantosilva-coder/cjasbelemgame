import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const row = z.object({
  id: z.string(),
  sender_id: z.string(),
  recipient_id: z.string(),
  sender_name: z.string(),
  recipient_name: z.string(),
  created_at: z.string(),
  body: z.string().optional(),
});
export type AdminChatRow = z.infer<typeof row>;
export const reviewPrivateChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pin: z.string().min(4).max(128),
        reason: z.string().trim().min(10).max(500),
        pair: z.object({ a: z.string().uuid(), b: z.string().uuid() }).optional(),
        cursor: z
          .object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "no-store, private");
    const { data: admin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !admin) throw new Error("Acesso restrito aos administradores.");
    const expected = process.env["ADMIN_CHAT_PIN"];
    if (!expected)
      throw new Error("Configure o segredo ADMIN_CHAT_PIN no servidor para ativar esta área.");
    // Compare equal-size digests; the configured secret never enters a client bundle.
    const digest = async (value: string) =>
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    const [actualHash, expectedHash] = await Promise.all([digest(data.pin), digest(expected)]);
    let difference = 0;
    for (let i = 0; i < actualHash.length; i++) difference |= actualHash[i]! ^ expectedHash[i]!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: response, error } = await supabaseAdmin.rpc("review_private_chats", {
      _admin: context.userId,
      _pin_valid: difference === 0,
      _reason: data.reason,
      ...(data.pair ? { _a: data.pair.a, _b: data.pair.b } : {}),
      ...(data.cursor ? { _before: data.cursor.at, _before_id: data.cursor.id } : {}),
    });
    if (error)
      throw new Error("Não foi possível consultar. Confira a migração e a conexão do servidor.");
    const parsed = z
      .object({ ok: z.boolean(), error: z.string().optional(), items: z.array(row).optional() })
      .parse(response);
    if (!parsed.ok) {
      if (parsed.error === "locked")
        throw new Error("Acesso bloqueado por 15 minutos após tentativas incorretas.");
      if (parsed.error === "invalid_pin") throw new Error("Senha adicional incorreta.");
      throw new Error("Consulta não autorizada. Confira seu acesso e a justificativa.");
    }
    return parsed.items ?? [];
  });
