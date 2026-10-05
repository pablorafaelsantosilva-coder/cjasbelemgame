import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSharedChatMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ before: z.string().datetime().nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("get_chat_shared_media", {
      _before: data.before ?? undefined,
      _limit: 40,
    });
    if (error) throw error;
    const paths = [...new Set((rows ?? []).flatMap((row) => row.file_paths))];
    if (paths.length === 0) return { rows: rows ?? [], urls: {} as Record<string, string> };

    // The RPC returns only consented, approved media. Sign with the user's session;
    // no broad storage read policy or permanent public URL is needed.
    const { data: signed, error: signError } = await context.supabase.storage
      .from("proofs").createSignedUrls(paths, 600);
    if (signError) throw signError;
    const urls: Record<string, string> = {};
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    }
    return { rows: rows ?? [], urls };
  });