"use client";

import { useTranslations } from "next-intl";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** Rayon du joystick (px) : pousser au-delà donne la pleine intensité. */
const RADIUS = 56;

interface StickProps {
  label: string;
  side: "left" | "right";
  onChange(dx: number, dy: number): void;
}

/**
 * Joystick qui apparaît là où le pouce se pose, dans sa moitié d'écran. La gauche et la droite sont physiques
 * (pas de « start/end ») : c'est la position des pouces qui compte, quelle que soit la langue.
 */
function Stick({ label, side, onChange }: StickProps) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);

  function place(x: number, y: number, dx: number, dy: number) {
    if (base.current) {
      base.current.style.opacity = "1";
      base.current.style.transform = `translate(${x - RADIUS}px, ${y - RADIUS}px)`;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx * RADIUS}px, ${dy * RADIUS}px)`;
  }

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (origin.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    origin.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top };
    place(origin.current.x, origin.current.y, 0, 0);
    onChange(0, 0);
  }

  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = (e.clientX - rect.left - o.x) / RADIUS;
    let dy = (e.clientY - rect.top - o.y) / RADIUS;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    place(o.x, o.y, dx, dy);
    onChange(dx, dy);
  }

  function up(e: ReactPointerEvent<HTMLDivElement>) {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    if (base.current) base.current.style.opacity = "0";
    onChange(0, 0);
  }

  return (
    <div
      role="presentation"
      aria-label={label}
      className={`absolute bottom-0 top-1/3 touch-none ${side === "left" ? "left-0 w-[45%]" : "right-0 w-[45%]"}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div ref={base} className="pointer-events-none absolute left-0 top-0 grid size-28 place-items-center rounded-full border-2 border-ink/60 bg-surface/25 opacity-0" aria-hidden="true">
        <div ref={knob} className="size-12 rounded-full border-2 border-ink bg-surface/80" />
      </div>
    </div>
  );
}

function RoundButton({ label, onPress, children, className = "" }: { label: string; onPress(): void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto grid size-14 touch-none place-items-center rounded-full border-2 border-ink bg-surface/90 text-[0.65rem] font-extrabold leading-tight shadow-[0_3px_0_0_var(--mm-shadow)] active:translate-y-0.5 ${className}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPress();
      }}
    >
      {children}
    </button>
  );
}

/** Commandes tactiles : joysticks de déplacement et de visée (tir en poussant à fond), boutons d'action (≥ 56 px). */
export function TouchControls({
  onMove,
  onAim,
  onAbility,
  onWeapon,
  onReload,
  onPickup,
  pickupLabel,
  abilityReady,
  abilityCooldown,
}: {
  onMove(dx: number, dy: number): void;
  onAim(dx: number, dy: number): void;
  onAbility(): void;
  onWeapon(): void;
  onReload(): void;
  onPickup(): void;
  pickupLabel: string | null;
  abilityReady: boolean;
  /** Part de la recharge restante (1 → 0). */
  abilityCooldown: number;
}) {
  const t = useTranslations("match.controls");
  return (
    <div className="absolute inset-0 select-none">
      <Stick label={t("move")} side="left" onChange={onMove} />
      <Stick label={t("aim")} side="right" onChange={onAim} />
      <div className="pointer-events-none absolute bottom-4 right-[46%] grid gap-3">
        {/* Ramasser : n'apparaît que près d'un objet utile, entre les deux joysticks. */}
        {pickupLabel ? (
          <RoundButton label={pickupLabel} onPress={onPickup} className="bg-sticker">
            {t("pickup")}
          </RoundButton>
        ) : null}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-3 grid gap-3">
        <RoundButton label={t("ability")} onPress={onAbility} className={abilityReady ? "bg-candy text-[var(--mm-accent-ink)]" : ""}>
          <span
            className="grid size-full place-items-center rounded-full"
            style={abilityReady ? undefined : { background: `conic-gradient(var(--color-line) ${Math.round(abilityCooldown * 360)}deg, transparent 0)` }}
          >
            {t("ability")}
          </span>
        </RoundButton>
        <RoundButton label={t("weapon")} onPress={onWeapon}>
          ⇄
        </RoundButton>
        <RoundButton label={t("reload")} onPress={onReload}>
          R
        </RoundButton>
      </div>
    </div>
  );
}
