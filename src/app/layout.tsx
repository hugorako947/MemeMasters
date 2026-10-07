import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { MotionConfig } from "motion/react";
import "@fontsource/anton/400.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "./globals.css";
import { cookies } from "next/headers";
import { GAME_CONFIG } from "@/config/game.config";
import { isLocale, localeDir } from "@/lib/i18n/locales";
import { parseAppearance, THEME_COOKIES, themeAttributes } from "@/lib/theme/theme";
import { publicEnv } from "@/lib/env.public";
import { NavigationTracker } from "@/components/layout/NavigationTracker";
import { PwaProvider } from "@/components/pwa/PwaProvider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: GAME_CONFIG.GAME_NAME, template: `%s · ${GAME_CONFIG.GAME_NAME}` },
    description: t("description"),
    applicationName: GAME_CONFIG.GAME_NAME,
    appleWebApp: { capable: true, title: GAME_CONFIG.GAME_SHORT_NAME, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f0ff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  // Thème lu dans les cookies : appliqué dès le premier affichage, sans clignotement.
  const appearance = parseAppearance({
    theme: cookieStore.get(THEME_COOKIES.theme)?.value,
    accent: cookieStore.get(THEME_COOKIES.accent)?.value,
    base: cookieStore.get(THEME_COOKIES.base)?.value,
  });
  const { style, ...themeAttrs } = themeAttributes(appearance);
  return (
    <html lang={locale} dir={isLocale(locale) ? localeDir(locale) : "ltr"} {...themeAttrs} style={style}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {/* Respecte prefers-reduced-motion pour toutes les animations Motion. */}
          <MotionConfig reducedMotion="user">
            <PwaProvider>
              {/* Tout le site est dans #mm-app : flouté quand une fiche de carte est ouverte. */}
              <NavigationTracker />
              <div id="mm-app">{children}</div>
            </PwaProvider>
          </MotionConfig>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
