import QRCode from "qrcode";
import { publicEnv } from "@/lib/env.public";

/**
 * QR code vers /installer, généré côté serveur en SVG (toujours noir sur
 * blanc, même en thème inversé, pour rester lisible par les appareils photo).
 */
export async function InstallQr({ size = 160, label }: { size?: number; label: string }) {
  const url = `${publicEnv.siteUrl}/installer?src=qr`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1a1238", light: "#ffffff" } });
  return (
    <div
      role="img"
      aria-label={label}
      className="mm-qr shrink-0 overflow-hidden rounded-2xl border-[3px] border-ink bg-white p-2 shadow-[0_4px_0_0_var(--mm-shadow)]"
      style={{ width: size, height: size }}
      // SVG produit par la bibliothèque qrcode à partir de notre propre URL : aucun contenu utilisateur.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
