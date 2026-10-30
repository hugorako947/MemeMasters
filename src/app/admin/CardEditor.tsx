"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, startTransition, type FormEvent } from "react";
import { CardDetailDialog } from "@/components/card/CardDetailDialog";
import { MemeCard } from "@/components/card/MemeCard";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { Button } from "@/components/ui/Button";
import { ImagePicker, type ImagePickerLabels } from "@/components/ui/ImagePicker";
import { toast } from "@/components/ui/Toast";
import { RARITIES, type Rarity } from "@/config/rarities";
import { cardArtDataUri } from "@/lib/art/generate";
import type { Card } from "@/lib/validation/card";
import { saveCard, type CardFormState } from "./actions";

export type EditorCard = Card & { isActive?: boolean; isDroppable?: boolean };

export interface CommunitySource {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  artSeed: number;
  author: string | null;
  votes: number;
}

const PICKER_LABELS: ImagePickerLabels = {
  image: "Image",
  photo: "Photo",
  capture: "Capturer",
  cancel: "Annuler",
  preparing: "Préparation de l'image…",
  cameraBlocked: "Caméra inaccessible : autorisez-la dans le navigateur, ou utilisez « Image ».",
  cameraInsecure: "La webcam demande une adresse sécurisée (https) : la sélection de fichier s'ouvre à la place.",
  unreadable: "Cette image n'a pas pu être lue. Essayez une photo JPEG ou PNG.",
  notImage: "Ce fichier n'est pas une image.",
};

const IDLE: CardFormState = { status: "idle", message: "" };
const input = "min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal";

/** Effets d'attaque spéciale proposés à l'admin : libellé, sens de l'intensité, bornes de l'intensité et de la durée. */
const SPECIAL_ORDER = ["none", "dot", "stun", "debuff", "buff", "pierce", "drain", "multi"] as const;
const SPECIAL_UI: Record<string, { label: string; pct: string; pctMin: number; pctMax: number; sec?: [number, number] }> = {
  none: { label: "Sprint (vitesse en plus)", pct: "vitesse en plus", pctMin: 10, pctMax: 60, sec: [2, 8] },
  dot: { label: "Brûlure (dégâts dans le temps)", pct: "brûlure (% des PV par seconde)", pctMin: 1, pctMax: 30, sec: [2, 10] },
  stun: { label: "Étourdissement", pct: "chance (%)", pctMin: 1, pctMax: 60, sec: [1, 3] },
  debuff: { label: "Affaiblissement (baisse de stat)", pct: "baisse (%)", pctMin: 10, pctMax: 50, sec: [2, 8] },
  buff: { label: "Boost (hausse de stat)", pct: "hausse (%)", pctMin: 10, pctMax: 50, sec: [2, 8] },
  pierce: { label: "Perce-défense", pct: "armure ignorée (%)", pctMin: 10, pctMax: 80, sec: [2, 8] },
  drain: { label: "Vol de vie", pct: "vol de vie (%)", pctMin: 10, pctMax: 60, sec: [2, 6] },
  multi: { label: "Multi-coup (rafale)", pct: "dégâts par coup (%)", pctMin: 25, pctMax: 60 },
};

/**
 * Formulaire de carte du tableau de bord, avec aperçu en direct de la carte.
 * Illustration : générée automatiquement, ou image / photo de l'appareil
 * (préparée dans le navigateur avant l'envoi). En cas d'erreur, rien de ce
 * qui a été saisi n'est perdu.
 */
export function CardEditor({ card, community, isSuper }: { card: EditorCard | null; community: CommunitySource | null; isSuper: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(saveCard, IDLE);
  const startImage = card?.imageUrl ?? community?.imageUrl ?? null;
  const [mode, setMode] = useState<"auto" | "image">(startImage ? "image" : "auto");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(startImage);
  const [fields, setFields] = useState<Record<string, string>>({});
  // Aperçu agrandi et détaillé, comme une carte de la Collection.
  const [zoomed, setZoomed] = useState(false);
  const closeZoom = useCallback(() => setZoomed(false), []);

  useEffect(() => {
    if (state.status === "done") {
      toast.success(state.message);
      if (state.next) {
        startNavigationProgress();
        router.push(state.next);
      }
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, router]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const d = card?.defenseAbility?.effect;
  const defenseValue = d && "percent" in d ? d.percent : d && "chance" in d ? d.chance : 10;
  // Effet spécial actuel, lu de façon tolérante (champs optionnels) pour pré-remplir le formulaire.
  const sp = (card?.specialAttack.effect ?? { kind: "none" }) as {
    kind: string;
    percent?: number;
    chance?: number;
    seconds?: number;
    turns?: number;
    stat?: string;
    all?: boolean;
    hits?: number;
  };
  const initial = {
    name: card?.name ?? community?.name ?? "",
    description: card?.description ?? community?.description ?? "",
    rarity: card?.rarity ?? "commune",
    hp: String(card?.hp ?? 90),
    atk: String(card?.atk ?? 40),
    def: String(card?.def ?? 35),
    spd: String(card?.spd ?? 70),
    attackName: card?.normalAttack.name ?? "",
    attackPower: String(card?.normalAttack.power ?? 30),
    specialName: card?.specialAttack.name ?? "",
    specialPower: String(card?.specialAttack.power ?? 60),
    specialCost: String(card?.specialAttack.energyCost ?? 3),
    specialKind: sp.kind,
    specialPercent: String(sp.percent ?? sp.chance ?? 40),
    specialSeconds: String(sp.seconds ?? sp.turns ?? 4),
    specialStat: sp.all ? "all" : (sp.stat ?? "atk"),
    specialHits: String(sp.hits ?? 3),
    defenseName: card?.defenseAbility.name ?? "",
    defenseKind: d?.kind ?? "heal",
    defenseValue: String(defenseValue),
  };
  const v = { ...initial, ...fields };

  // Aperçu en direct : la carte telle que les joueurs la verront.
  const previewCard: Card = (() => {
    const n = (s: string, lo: number, hi: number, dflt: number) => {
      const x = Number.parseInt(s, 10);
      return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : dflt;
    };
    const dv = n(v.defenseValue, 0, 60, 10);
    const effect: Card["defenseAbility"]["effect"] =
      v.defenseKind === "reflect"
        ? { kind: "reflect", percent: Math.max(10, Math.min(50, dv)) }
        : v.defenseKind === "dodge"
          ? { kind: "dodge", chance: Math.max(5, Math.min(40, dv)) }
          : v.defenseKind === "cleanse"
            ? { kind: "cleanse" }
            : v.defenseKind === "recharge"
              ? { kind: "recharge", amount: 1 }
              : { kind: "heal", percent: Math.max(5, Math.min(20, dv)) };
    // Effet spécial (mêmes bornes que le serveur) pour l'aperçu de la carte.
    const scope = v.specialStat === "all" ? { all: true as const } : { stat: (["atk", "def", "spd"].includes(v.specialStat) ? v.specialStat : "atk") as "atk" | "def" | "spd" };
    const special: Card["specialAttack"]["effect"] =
      v.specialKind === "dot"
        ? { kind: "dot", percent: n(v.specialPercent, 1, 30, 10), seconds: n(v.specialSeconds, 2, 10, 4) }
        : v.specialKind === "stun"
          ? { kind: "stun", chance: n(v.specialPercent, 1, 60, 20), seconds: n(v.specialSeconds, 1, 3, 2) }
          : v.specialKind === "debuff"
            ? { kind: "debuff", ...scope, percent: n(v.specialPercent, 10, 50, 25), seconds: n(v.specialSeconds, 2, 8, 4) }
            : v.specialKind === "buff"
              ? { kind: "buff", ...scope, percent: n(v.specialPercent, 10, 50, 20), seconds: n(v.specialSeconds, 2, 8, 5) }
              : v.specialKind === "pierce"
                ? { kind: "pierce", percent: n(v.specialPercent, 10, 80, 40), seconds: n(v.specialSeconds, 2, 8, 4) }
                : v.specialKind === "drain"
                  ? { kind: "drain", percent: n(v.specialPercent, 10, 60, 30), seconds: n(v.specialSeconds, 2, 6, 3) }
                  : v.specialKind === "multi"
                    ? { kind: "multi", hits: n(v.specialHits, 2, 4, 3), percent: n(v.specialPercent, 25, 60, 40) }
                    : { kind: "none", percent: n(v.specialPercent, 10, 60, 40), seconds: n(v.specialSeconds, 2, 8, 2) };
    return {
      id: card?.id ?? "00000000-0000-4000-8000-000000000000",
      slug: "apercu",
      name: v.name || "Nom de la carte",
      description: v.description,
      rarity: (RARITIES as readonly string[]).includes(v.rarity) ? (v.rarity as Rarity) : "commune",
      hp: n(v.hp, 60, 140, 90),
      atk: n(v.atk, 20, 65, 40),
      def: n(v.def, 20, 65, 35),
      spd: n(v.spd, 10, 100, 70),
      normalAttack: { name: v.attackName || "Attaque", power: n(v.attackPower, 25, 35, 30) },
      specialAttack: { name: v.specialName || "Spéciale", power: n(v.specialPower, 50, 90, 60), energyCost: n(v.specialCost, 2, 4, 3), effect: special },
      defenseAbility: { name: v.defenseName || "Défense", effect },
      artSeed: card?.artSeed ?? community?.artSeed ?? 1,
      imageUrl: mode === "image" && preview ? preview : cardArtDataUri({ seed: card?.artSeed ?? community?.artSeed ?? 1, rarity: (v.rarity as Rarity) ?? "commune" }),
    };
  })();

  function onChange(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    if (t.name && t.name in initial) setFields((f) => ({ ...f, [t.name]: t.value }));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Envoi manuel : le formulaire n'est pas vidé, et l'image préparée remplace le fichier d'origine.
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("artMode", mode);
    if (mode === "image" && file) fd.set("art", file);
    startTransition(() => formAction(fd));
  }

  const isNew = !card;
  const spUi = SPECIAL_UI[v.specialKind] ?? SPECIAL_UI.none;
  const submitLabel = isSuper
    ? community
      ? "Faire sortir la carte dans le jeu"
      : isNew
        ? "Créer la carte"
        : "Enregistrer la carte"
    : "Envoyer au Super Admin pour validation";

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {card ? <input type="hidden" name="id" value={card.id} /> : null}
        {community ? <input type="hidden" name="communityId" value={community.id} /> : null}
        {community ? (
          <p className="rounded-xl border-2 border-dashed border-ink bg-paper p-3 text-sm sm:col-span-2 lg:col-span-3">
            Carte de la Communauté proposée par <strong>{community.author ?? "un joueur"}</strong> ({community.votes} vote{community.votes > 1 ? "s" : ""}). Choisissez sa rareté et ses
            statistiques : elle sortira dans le jeu et la proposition sera marquée « sortie ».
          </p>
        ) : null}
        <label className="grid gap-1 text-sm font-bold">
          Nom
          <input name="name" defaultValue={initial.name} maxLength={40} required className={input} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Rareté
          <select name="rarity" defaultValue={initial.rarity} className={input}>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold sm:col-span-2 lg:col-span-3">
          Description
          <textarea name="description" defaultValue={initial.description} maxLength={280} rows={2} className="rounded-xl border-2 border-ink bg-surface px-3 py-2 font-normal" />
        </label>
        <Num label="PV (60–140)" name="hp" value={initial.hp} min={60} max={140} />
        <Num label="Attaque (20–65)" name="atk" value={initial.atk} min={20} max={65} />
        <Num label="Défense (20–65)" name="def" value={initial.def} min={20} max={65} />
        <Num label="Vitesse (10–100)" name="spd" value={initial.spd} min={10} max={100} />
        <Text label="Attaque : nom" name="attackName" value={initial.attackName} />
        <Num label="Attaque : puissance (25–35)" name="attackPower" value={initial.attackPower} min={25} max={35} />
        <Text label="Spéciale : nom" name="specialName" value={initial.specialName} />
        <Num label="Spéciale : puissance (50–90)" name="specialPower" value={initial.specialPower} min={50} max={90} />
        <Num label="Spéciale : énergie (2–4)" name="specialCost" value={initial.specialCost} min={2} max={4} />
        <label className="grid gap-1 text-sm font-bold">
          Spéciale : effet
          <select name="specialKind" defaultValue={initial.specialKind} className={input}>
            {SPECIAL_ORDER.map((k) => (
              <option key={k} value={k}>
                {SPECIAL_UI[k].label}
              </option>
            ))}
          </select>
        </label>
        <Num label={`Spéciale : ${spUi.pct} (${spUi.pctMin}–${spUi.pctMax})`} name="specialPercent" value={initial.specialPercent} min={1} max={90} />
        {spUi.sec ? <Num label={`Spéciale : durée en secondes (${spUi.sec[0]}–${spUi.sec[1]})`} name="specialSeconds" value={initial.specialSeconds} min={1} max={10} /> : null}
        {v.specialKind === "multi" ? <Num label="Spéciale : nombre de coups (2–4)" name="specialHits" value={initial.specialHits} min={2} max={4} /> : null}
        {v.specialKind === "debuff" || v.specialKind === "buff" ? (
          <label className="grid gap-1 text-sm font-bold">
            Spéciale : statistique visée
            <select name="specialStat" defaultValue={initial.specialStat} className={input}>
              <option value="atk">Attaque</option>
              <option value="def">Défense</option>
              <option value="spd">Vitesse</option>
              <option value="all">Toutes les statistiques</option>
            </select>
          </label>
        ) : null}
        <Text label="Défense : nom" name="defenseName" value={initial.defenseName} />
        <label className="grid gap-1 text-sm font-bold">
          Défense : effet
          <select name="defenseKind" defaultValue={initial.defenseKind} className={input}>
            <option value="heal">Soin (%)</option>
            <option value="reflect">Renvoi de dégâts (%)</option>
            <option value="dodge">Esquive (% de chances)</option>
            <option value="cleanse">Annule les effets négatifs</option>
            <option value="recharge">Recharge 1 énergie</option>
          </select>
        </label>
        <Num label="Défense : valeur (soin 5–20, renvoi 10–50, esquive 5–40)" name="defenseValue" value={initial.defenseValue} min={0} max={60} />

        <fieldset className="grid gap-3 rounded-2xl border-2 border-ink p-3 sm:col-span-2 lg:col-span-3">
          <legend className="px-1 text-sm font-bold">Illustration</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'illustration">
            {(
              [
                ["auto", "Générée automatiquement"],
                ["image", "Image ou photo"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold ${mode === m ? "bg-ink text-paper" : "bg-surface"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "auto" ? (
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="reshuffleArt" className="size-4" /> Tirer une nouvelle illustration à l&apos;enregistrement
            </label>
          ) : (
            <>
              <ImagePicker
                labels={PICKER_LABELS}
                onPick={(f) => {
                  setFile(f);
                  setPreview(URL.createObjectURL(f));
                }}
              />
              <p className="text-xs text-ink-soft">
                {file
                  ? `Image prête (${Math.max(1, Math.round(file.size / 1024))} Ko). Elle sera recadrée au format de la carte.`
                  : preview
                    ? "Image actuelle conservée. Choisissez-en une autre pour la remplacer."
                    : "Image depuis l'ordinateur ou le téléphone, ou photo prise sur le moment. Elle est allégée avant l'envoi."}
              </p>
            </>
          )}
        </fieldset>

        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="active" defaultChecked={card ? card.isActive !== false : true} className="size-4" /> Active dans le jeu
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="droppable" defaultChecked={card ? card.isDroppable !== false : true} className="size-4" /> Peut sortir des boosters
        </label>
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2 lg:col-span-3">
          <input type="checkbox" name="announce" defaultChecked={Boolean(community)} className="size-4" /> Annoncer dans les news (les joueurs reçoivent une notification)
        </label>
        {state.status === "error" ? (
          <p role="alert" className="rounded-xl border-2 border-danger bg-surface p-3 text-sm font-semibold sm:col-span-2 lg:col-span-3">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <Button type="submit" pending={pending} className="px-6">
            {pending ? (file ? "Envoi de l'image…" : "Enregistrement…") : submitLabel}
          </Button>
          {!isSuper ? <span className="text-sm text-ink-soft">Rien ne change dans le jeu tant que le Super Admin n&apos;a pas validé.</span> : null}
        </div>
      </div>

      <aside className="grid content-start justify-items-center gap-2 lg:sticky lg:top-4">
        <p className="text-sm font-bold text-ink-soft">Aperçu (cliquez pour l&apos;agrandir)</p>
        <div className="w-full max-w-64">
          <MemeCard card={previewCard} onOpen={() => setZoomed(true)} />
        </div>
        {zoomed ? <CardDetailDialog card={previewCard} onClose={closeZoom} /> : null}
      </aside>
    </form>
  );
}

function Num({ label, name, value, min, max }: { label: string; name: string; value: string; min: number; max: number }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <input name={name} type="number" inputMode="numeric" defaultValue={value} min={min} max={max} required className={input} />
    </label>
  );
}

function Text({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <input name={name} defaultValue={value} maxLength={32} required className={input} />
    </label>
  );
}
