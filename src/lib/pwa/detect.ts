/**
 * Reconnaît l'appareil et le navigateur, pour afficher sur /installer
 * uniquement les instructions qui marchent. Fonction pure, testée sur des
 * agents utilisateurs réels.
 */
export type InstallPlatform =
  | "ios-safari" //        iPhone / iPad dans Safari : Partager → Sur l'écran d'accueil
  | "ios-other" //         iPhone dans Chrome, Edge, Firefox : leur bouton Partager, sinon Safari
  | "android" //           Android (Chrome, Edge, Samsung…) : bouton Installer ou menu ⋮
  | "in-app" //            navigateur intégré (Instagram, TikTok…) : ouvrir dans le vrai navigateur
  | "desktop-chromium" //  ordinateur avec Chrome ou Edge : bouton Installer
  | "desktop-other"; //    autre ordinateur : scanner le QR code avec le téléphone

const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|musical_ly|Bytedance|TikTok|Snapchat|Twitter|LinkedInApp|Pinterest|Line\//i;

export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent || "";
  if (IN_APP.test(ua)) return "in-app";
  // iPadOS se présente comme un Mac : on le repère à son écran tactile.
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (isIOS) return /CriOS|EdgiOS|FxiOS|OPiOS|GSA\//i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) return "android";
  if (/Edg\/|Chrome\//i.test(ua) && !/OPR\//i.test(ua)) return "desktop-chromium";
  return "desktop-other";
}

export function isMobilePlatform(p: InstallPlatform): boolean {
  return p === "ios-safari" || p === "ios-other" || p === "android" || p === "in-app";
}
