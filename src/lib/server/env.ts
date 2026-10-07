import "server-only";
import { z } from "zod";

/**
 * Variables secrètes, lues uniquement côté serveur et validées au premier
 * accès (pas au build : `next build` doit pouvoir tourner sans secrets).
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgres"), "URL Postgres attendue")
    .refine((v) => {
      try {
        decodeURIComponent(new URL(v).password);
        return true;
      } catch {
        return false;
      }
    }, "mot de passe mal encodé (caractère % ou spécial) : lancez `npm run doctor`"),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ");
    throw new Error(`Variables d'environnement serveur invalides ou manquantes : ${fields}. Voir .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
