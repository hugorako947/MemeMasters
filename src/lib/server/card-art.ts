import "server-only";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { publicEnv } from "@/lib/env.public";
import { serverEnv } from "./env";

export const CARD_ART_BUCKET = "card-art";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function cardArtPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${CARD_ART_BUCKET}/${path.replace(/^\/+/, "")}`;
}

function adminStorage() {
  const secret = serverEnv().SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new CardArtError("Stockage des images non configuré (SUPABASE_SECRET_KEY manquante sur le serveur).");
  }
  return createClient(publicEnv.supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(CARD_ART_BUCKET);
}

/** Erreur d'illustration avec un message clair, affichable tel quel. */
export class CardArtError extends Error {}

/**
 * Redimensionne et téléverse une illustration dans le bucket public.
 * `folder` : « cartes », « demandes » (en attente du Super Admin) ou « communaute ».
 * Chaque envoi a un nom unique : une nouvelle image s'affiche tout de suite
 * (pas d'ancienne version gardée en cache par le navigateur ou le CDN).
 */
export async function uploadCardArt(folder: "cartes" | "demandes" | "communaute", key: string, file: File): Promise<string> {
  if (file.size <= 0) throw new CardArtError("Le fichier d'illustration est vide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new CardArtError("Image trop lourde (8 Mo maximum).");
  const type = file.type || "application/octet-stream";
  if (!ACCEPTED.has(type) && !type.startsWith("image/")) {
    throw new CardArtError("Format d'image non pris en charge (JPEG, PNG, WebP ou GIF).");
  }
  const input = Buffer.from(await file.arrayBuffer());
  let body: Buffer;
  try {
    body = await sharp(input)
      .rotate()
      .resize(800, 640, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new CardArtError("Cette image n'a pas pu être lue. Essayez une photo au format JPEG ou PNG.");
  }
  const path = `${folder}/${key}-${Date.now().toString(36)}.webp`;
  const storage = adminStorage();
  const { error } = await storage.upload(path, body, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    console.error("[card-art] téléversement", error);
    throw new CardArtError("Le stockage des images ne répond pas. Réessayez dans un instant.");
  }
  return path;
}

export async function removeCardArt(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await adminStorage().remove([path.replace(/^\/+/, "")]);
  } catch {
    // Le bucket peut être absent en local : la carte est tout de même supprimée.
  }
}
