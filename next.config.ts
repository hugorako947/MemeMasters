import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";
import { networkInterfaces } from "node:os";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** En-têtes de sécurité communs. La CSP stricte (avec nonce) arrive en phase 7. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * En développement, Next.js n'accepte que les requêtes venant de localhost.
 * On autorise aussi l'adresse de l'ordinateur sur le Wi-Fi (pour ouvrir le jeu
 * sur un téléphone du même réseau) et les tunnels HTTPS de test.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [...lanAddresses, "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSerwist(withNextIntl(nextConfig));
