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
    throw new Error("SUPABASE_SECRET_KEY manquante : impossible de stocker une illustration.");
  }
  return createClient(publicEnv.supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(CARD_ART_BUCKET);
}

/** Redimensionne et téléverse une illustration de carte dans le bucket public. */
export async function uploadCardArt(cardId: string, file: File): Promise<string> {
  if (file.size <= 0) throw new Error("Fichier d'illustration vide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image trop lourde (8 Mo maximum).");
  const type = file.type || "application/octet-stream";
  if (!ACCEPTED.has(type) && !type.startsWith("image/")) {
    throw new Error("Format d'image non pris en charge (JPEG, PNG, WebP ou GIF).");
  }
  const input = Buffer.from(await file.arrayBuffer());
  const body = await sharp(input)
    .rotate()
    .resize(800, 640, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toBuffer();
  const path = `${cardId}.webp`;
  const storage = adminStorage();
  const { error } = await storage.upload(path, body, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error("Téléversement de l'illustration impossible.");
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
