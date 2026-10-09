import "server-only";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env.public";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Adresse IPv4 de l'ordinateur sur le réseau local (Wi-Fi ou câble), si elle existe. */
export function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

/**
 * Adresse publique du site, telle qu'on l'utilise vraiment : celle de la
 * requête (domaine Vercel, tunnel HTTPS…). En local (localhost), on la
 * remplace par l'adresse de l'ordinateur sur le Wi-Fi, qu'un téléphone du
 * même réseau peut ouvrir.
 */
export async function publicBaseUrl(): Promise<{ url: string; https: boolean; lan: boolean }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return { url: publicEnv.siteUrl, https: publicEnv.siteUrl.startsWith("https:"), lan: false };
  const [hostname, port] = host.startsWith("[") ? [host.slice(0, host.indexOf("]") + 1), host.split("]:")[1]] : host.split(":");
  const proto = h.get("x-forwarded-proto") ?? (LOCAL_HOSTS.has(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? "http" : "https");
  if (LOCAL_HOSTS.has(hostname)) {
    const lan = lanAddress();
    if (lan) return { url: `http://${lan}${port ? `:${port}` : ""}`, https: false, lan: true };
  }
  const isLan = /^(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
  return { url: `${proto}://${host}`, https: proto === "https", lan: isLan };
}
