import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Sert le service worker (/serwist/sw.js) compilé depuis src/app/sw.ts.
 * La révision change à chaque déploiement : la page hors ligne est remise en cache.
 */
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: "/hors-ligne", revision }],
});
