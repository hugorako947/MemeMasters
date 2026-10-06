import type { MetadataRoute } from "next";
import { GAME_CONFIG } from "@/config/game.config";

/** Manifest de la PWA, construit depuis la configuration (nom du jeu modifiable en un seul endroit). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: GAME_CONFIG.GAME_NAME,
    short_name: GAME_CONFIG.GAME_SHORT_NAME,
    description: GAME_CONFIG.GAME_TAGLINE,
    lang: "fr",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f0ff",
    theme_color: "#f3f0ff",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
