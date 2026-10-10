import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reviewPrivateMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    password: z.string().min(1).max(128),
    participant: z.string().uuid().nullable(),
    before: z.object({ at: z.string().datetime(), id: z.string().uuid() }).nullable(),
  }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !admin) throw new Error("Acesso restrito à administração.");
    const { count, error: limitError } = await context.supabase.from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", context.userId).eq("action", "private_chat_password_failed")
      .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString());
    if (limitError) throw new Error("Não foi possível verificar o acesso.");
    if ((count ?? 0) >= 5) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
    const expected = process.env["ADMIN_CHAT_PASSWORD"];
    if (!expected) throw new Error("A senha de acesso ainda não foi configurada.");
    const valid = timingSafeEqual(
      createHash("sha256").update(data.password).digest(),
      createHash("sha256").update(expected).digest(),
    );
    const { error: auditError } = await context.supabase.from("audit_logs").insert({
      admin_id: context.userId,
      action: valid ? "private_chat_review" : "private_chat_password_failed",
      entity_type: "direct_messages",
      details: valid ? { participant: data.participant, paginated: !!data.before } : {},
    });
    if (auditError) throw new Error("Não foi possível registrar o acesso.");
    if (!valid) throw new Error("Senha incorreta.");

    // Privileged reads are reachable only after both checks and a successful audit write.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("direct_messages")
      .select("id,sender_id,recipient_id,body,reply_to_id,created_at")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
    if (data.participant) query = query.or(`sender_id.eq.${data.participant},recipient_id.eq.${data.participant}`);
    if (data.before) query = query.or(`created_at.lt.${data.before.at},and(created_at.eq.${data.before.at},id.lt.${data.before.id})`);
    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível carregar as conversas.");
    const messages = (rows ?? []).slice(0, 50);
    const ids = [...new Set(messages.flatMap((m) => [m.sender_id, m.recipient_id]))];
    const { data: names, error: namesError } = ids.length
      ? await context.supabase.from("profiles").select("id,name").in("id", ids)
      : { data: [], error: null };
    if (namesError) throw new Error("Não foi possível carregar os participantes.");
    const last = messages.at(-1);
    return { messages, names: names ?? [], next: (rows?.length ?? 0) > 50 && last ? { at: last.created_at, id: last.id } : null };
  });