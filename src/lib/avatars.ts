import { supabase } from "@/integrations/supabase/client";

export const AVATAR_PREFIX = "avatar:";

export async function uploadAvatar(userId: string, file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Escolha uma foto de até 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Não foi possível preparar a foto."); }
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error("Não foi possível preparar a foto.")),
    "image/webp", 0.85,
  ));
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
  if (error) throw new Error("Não foi possível enviar a foto. Tente novamente.");
  return path;
}