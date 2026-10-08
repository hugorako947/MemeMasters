/**
 * Génère la migration SQL du jeu de départ à partir de src/content/cards/starter-set.ts.
 * Usage : npm run cards:sql (écrit supabase/migrations/20261010000900_jeu_de_depart.sql)
 */
import { writeFileSync } from "node:fs";
import { STARTER_SET } from "../src/content/cards/starter-set";

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
const j = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;

const rows = STARTER_SET.map(
  (c) =>
    `  (${q(c.id)}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, ${q(c.rarity)}, ${q(c.vibe)}, ` +
    `${c.hp}, ${c.atk}, ${c.def}, ${c.spd}, ${j(c.normalAttack)}, ${j(c.specialAttack)}, ${j(c.defenseAbility)}, ${c.artSeed})`,
);

const sql = `-- =============================================================================
-- MemeMasters – Jeu de départ : ${STARTER_SET.length} cartes originales
-- FICHIER GÉNÉRÉ par scripts/generate-cards-sql.mts depuis src/content/cards/starter-set.ts.
-- Les cartes déjà présentes (même slug) ne sont pas modifiées : l'équilibrage se
-- fera ensuite depuis l'administration.
-- =============================================================================

insert into public.cards
  (id, slug, name, description, rarity, vibe, hp, atk, def, spd, normal_attack, special_attack, defense_ability, art_seed)
values
${rows.join(",\n")}
on conflict (slug) do nothing;
`;

writeFileSync("supabase/migrations/20261010000900_jeu_de_depart.sql", sql);
console.log(`${STARTER_SET.length} cartes écrites.`);
