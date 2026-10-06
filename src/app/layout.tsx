import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { MotionConfig } from "motion/react";
import "@fontsource/anton/400.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "./globals.css";
import { GAME_CONFIG } from "@/config/game.config";
import { publicEnv } from "@/lib/env.public";
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
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {/* Respecte prefers-reduced-motion pour toutes les animations Motion. */}
          <MotionConfig reducedMotion="user">
            <PwaProvider>{children}</PwaProvider>
          </MotionConfig>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
