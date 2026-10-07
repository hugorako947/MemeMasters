/**
 * Diagnostic de l'installation : variables d'environnement, Supabase, base de données.
 *
 *   npm run doctor                  → vérifie tout et explique ce qui ne va pas
 *   npm run doctor -- --reset-limits → efface aussi les compteurs de « Trop de tentatives »
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string) => console.log(`  ⚠️  ${msg}`);
const fail = (msg: string) => console.log(`  ❌ ${msg}`);
let problems = 0;
const bad = (msg: string) => {
  problems++;
  fail(msg);
};

console.log("\n1. Variables d'environnement (.env.local)");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const dbUrl = process.env.DATABASE_URL ?? "";
let urlOk = false;
try {
  const u = new URL(url);
  urlOk = u.protocol === "https:" || u.protocol === "http:";
} catch {
  urlOk = false;
}
if (urlOk) ok(`NEXT_PUBLIC_SUPABASE_URL = ${url}`);
else bad(`NEXT_PUBLIC_SUPABASE_URL invalide : « ${url} ». Attendu : https://<identifiant>.supabase.co`);
if (key) ok(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY présente (${key.slice(0, 16)}…)`);
else bad("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est vide.");
let dbUrlOk = false;
try {
  const u = new URL(dbUrl);
  dbUrlOk = u.protocol.startsWith("postgres");
  try {
    decodeURIComponent(u.password);
  } catch {
    dbUrlOk = false;
    bad(
      "Le mot de passe de DATABASE_URL contient un caractère spécial mal écrit (souvent « % »). " +
        "Le plus simple : réinitialisez le mot de passe de la base avec uniquement des lettres et des chiffres " +
        "(Project Settings → Database → Reset database password). Sinon, encodez-le : % → %25, @ → %40, # → %23, / → %2F, : → %3A, ? → %3F, & → %26.",
    );
  }
  if (dbUrlOk || u.protocol.startsWith("postgres")) ok(`DATABASE_URL vers ${u.hostname}:${u.port || "5432"} (utilisateur ${decodeURIComponent(u.username)})`);
  if (dbUrl.includes("[YOUR-PASSWORD]")) bad("DATABASE_URL contient encore [YOUR-PASSWORD] : remplacez-le par le mot de passe de la base.");
  if (u.port && u.port !== "6543" && u.hostname.includes("pooler")) warn("Le pooler Supabase en mode transaction utilise le port 6543.");
} catch {
  bad("DATABASE_URL invalide. Si le mot de passe contient @ # / : ? % &, changez-le pour un mot de passe sans ces caractères.");
}

console.log("\n2. Supabase Auth");
if (urlOk && key) {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) {
      bad(`Supabase répond ${res.status}. Vérifiez l'URL et la clé publique.`);
    } else {
      const settings = (await res.json()) as {
        disable_signup?: boolean;
        mailer_autoconfirm?: boolean;
        external?: Record<string, boolean>;
      };
      ok("Supabase Auth joignable");
      if (settings.disable_signup) bad("Les inscriptions sont désactivées (Authentication → Sign In / Providers).");
      if (settings.external?.email === false) bad("La connexion par e-mail est désactivée (Authentication → Sign In / Providers → Email).");
      if (settings.mailer_autoconfirm) {
        ok("« Confirm email » est DÉSACTIVÉ : l'inscription connecte directement, sans e-mail (pratique pour tester).");
      } else {
        warn(
          "« Confirm email » est ACTIVÉ : chaque inscription envoie un e-mail. Sans SMTP personnel, Supabase n'en envoie que " +
            "quelques-uns par heure, et seulement aux adresses des membres du projet. Pour tester, désactivez-le ou configurez un SMTP.",
        );
      }
      if (settings.external?.google) ok("Connexion Google activée");
      else warn("Connexion Google non configurée (le bouton affichera une erreur).");
    }
  } catch (error) {
    bad(`Supabase injoignable : ${(error as Error).message}`);
  }
} else {
  warn("Ignoré : corrigez d'abord les variables ci-dessus.");
}

console.log("\n3. Base de données");
if (dbUrlOk) {
  const sql = postgres(dbUrl, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    await sql`select 1`;
    ok("Connexion réussie");
    const [tables] = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public' and table_name in ('profiles', 'player_private', 'player_wallets', 'rate_limits')`;
    if (tables.n === 4) ok("Tables du jeu présentes");
    else bad("Tables manquantes : lancez `npx supabase db push`.");
    const [col] = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.columns
      where table_schema = 'public' and table_name = 'player_private' and column_name = 'terms_version'`;
    if (col.n === 1) ok("Dernière migration appliquée (consentements)");
    else bad("Migration « consentements » manquante : lancez `npx supabase db push`.");
    if (tables.n === 4) {
      await sql`select public.check_rate_limit('doctor', 1000, 60)`;
      ok("Limitation de débit opérationnelle");
      const blocked = await sql<{ key: string; count: number }[]>`
        select key, count from public.rate_limits
        where window_start > now() - interval '1 hour' and key not like 'doctor%'
        order by count desc limit 5`;
      if (blocked.length > 0) {
        console.log("     Compteurs de l'heure écoulée :");
        for (const b of blocked) console.log(`       ${b.key} → ${b.count}`);
      }
      if (process.argv.includes("--reset-limits")) {
        const deleted = await sql`delete from public.rate_limits returning 1`;
        ok(`Compteurs de « Trop de tentatives » effacés (${deleted.length})`);
      }
    }
  } catch (error) {
    bad(`Connexion impossible : ${(error as Error).message}`);
    console.log("     Pistes : mot de passe de la base, adresse du « Transaction pooler » (bouton Connect), projet en pause.");
  } finally {
    await sql.end({ timeout: 2 });
  }
} else {
  warn("Ignoré : DATABASE_URL invalide.");
}

console.log(problems === 0 ? "\nTout est en ordre. ✨\n" : `\n${problems} problème(s) à corriger.\n`);
process.exitCode = problems === 0 ? 0 : 1;
