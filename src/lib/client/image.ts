/**
 * Prépare une image avant envoi : redimensionnée (1 600 px au plus), orientée
 * correctement et recompressée en JPEG. Une photo de téléphone de 5 à 12 Mo
 * devient un fichier de quelques centaines de Ko : l'envoi est rapide, même
 * en 4G, et passe sous les limites du serveur. Les formats que le navigateur
 * sait lire (HEIC sur iPhone, PNG, WebP…) sont ainsi tous acceptés.
 */
export const MAX_IMAGE_SIDE = 1600;

export class ImageError extends Error {
  constructor(readonly code: "not_image" | "unreadable") {
    super(code);
  }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Certains navigateurs refusent l'option : on passe par une balise <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError("unreadable");
  }
}

export async function prepareImage(file: Blob, name = "image.jpg"): Promise<File> {
  if (file.type && !file.type.startsWith("image/")) throw new ImageError("not_image");
  const img = await decode(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("unreadable");
    // Fond blanc : les zones transparentes (PNG) ne deviennent pas noires en JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new ImageError("unreadable");
    return new File([blob], name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    img.close();
  }
}
