import { supabase } from "@/integrations/supabase/client";

export const PROOFS_BUCKET = "proofs";

export async function signedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(PROOFS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function signedUrls(paths: string[], expiresIn = 3600) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage
    .from(PROOFS_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (!item.error && item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export function isVideo(fileType: string, path = "") {
  return (
    fileType.toLowerCase().startsWith("video") ||
    /\.(mp4|mov|m4v|webm|ogv|avi|mkv)(?:[?#]|$)/i.test(path)
  );
}
