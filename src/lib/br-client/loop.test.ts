import { describe, expect, it } from "vitest";
import { MatchClock } from "./loop";

describe("rythme de la partie (20 ticks par seconde, temps réel)", () => {
  it("donne le nombre de ticks dus et la position entre deux ticks pour le lissage", () => {
    const clock = new MatchClock(50, 100);
    clock.start(1000);
    expect(clock.due(1000)).toEqual({ ticks: 0, alpha: 0 });
    expect(clock.due(1025)).toEqual({ ticks: 0, alpha: 0.5 });
    expect(clock.due(1050)).toEqual({ ticks: 1, alpha: 0 });
    expect(clock.due(1180)).toEqual({ ticks: 2, alpha: 0.6000000000000001 });
  });

  it("le temps de jeu suit l'horloge : après une absence, la partie rattrape le retard, par paquets", () => {
    const clock = new MatchClock(50, 100);
    clock.start(0);
    // 30 s en arrière-plan : 600 ticks dus, rattrapés 100 par image.
    const parts: number[] = [];
    for (let k = 0; k < 7; k++) parts.push(clock.due(30_000).ticks);
    expect(parts).toEqual([100, 100, 100, 100, 100, 100, 0]);
    expect(clock.ticksDone).toBe(600);
    expect(clock.behind(30_000)).toBe(0);
  });

  it("jamais de retour en arrière ni de tick en double (horloge qui recule)", () => {
    const clock = new MatchClock(50, 100);
    clock.start(500);
    expect(clock.due(700).ticks).toBe(4);
    expect(clock.due(650)).toEqual({ ticks: 0, alpha: 0 });
    expect(clock.due(760).ticks).toBe(1);
  });
});
