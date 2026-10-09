import { describe, expect, it } from "vitest";
import { detectPlatform } from "./detect";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0",
  tiktok: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 musical_ly_2024",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0",
};

describe("détection de l'appareil pour /installer", () => {
  it.each([
    ["iPhone + Safari", UA.iphoneSafari, 5, "ios-safari"],
    ["iPhone + Chrome", UA.iphoneChrome, 5, "ios-other"],
    ["iPad (se présente comme un Mac)", UA.ipadAsMac, 5, "ios-safari"],
    ["Android + Chrome", UA.android, 5, "android"],
    ["navigateur d'Instagram", UA.instagram, 5, "in-app"],
    ["navigateur de TikTok", UA.tiktok, 5, "in-app"],
    ["PC + Edge", UA.windowsEdge, 0, "desktop-chromium"],
    ["Mac + Firefox", UA.macFirefox, 0, "desktop-other"],
    ["Mac + Safari (sans écran tactile)", UA.ipadAsMac, 0, "desktop-other"],
  ])("%s", (_, ua, touch, expected) => {
    expect(detectPlatform(ua, touch)).toBe(expected);
  });
});
