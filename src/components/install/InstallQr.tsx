import QRCode from "qrcode";
import { publicBaseUrl } from "@/lib/server/site-url";

/**
 * QR code vers /installer, généré côté serveur en SVG (toujours noir sur
 * blanc, même en thème inversé, pour rester lisible par les appareils photo).
 * Il suit l'adresse par laquelle on consulte le site : aucun réglage à faire.
 */
export async function InstallQr({ size = 160, label }: { size?: number; label: string }) {
  // Adresse réelle du site (Vercel, tunnel HTTPS, ou adresse Wi-Fi de l'ordinateur en local).
  const url = `${(await publicBaseUrl()).url}/installer?src=qr`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1a1238", light: "#ffffff" } });
  return (
    <div
      role="img"
      aria-label={label}
      className="mm-qr shrink-0 overflow-hidden rounded-2xl border-2 border-ink bg-white p-2 shadow-[0_3px_0_0_var(--mm-shadow)]"
      style={{ width: size, height: size }}
      // SVG produit par la bibliothèque qrcode à partir de notre propre URL : aucun contenu utilisateur.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
