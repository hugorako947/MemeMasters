/** Musique des parties : les morceaux de MATCH_MUSIC à la suite, en boucle, au volume réglé (0 à 100). */
import { MATCH_MUSIC } from "@/config/audio";

let player: HTMLAudioElement | null = null;
let index = 0;

export function startMusic(percent: number): void {
  if (MATCH_MUSIC.length === 0 || percent <= 0 || typeof Audio === "undefined") return;
  stopMusic();
  const audio = new Audio(MATCH_MUSIC[index % MATCH_MUSIC.length]);
  audio.volume = Math.min(1, percent / 100);
  audio.addEventListener("ended", () => {
    index++;
    startMusic(percent);
  });
  void audio.play().catch(() => {});
  player = audio;
}

export function stopMusic(): void {
  player?.pause();
  player = null;
}
