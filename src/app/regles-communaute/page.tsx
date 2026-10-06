import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { COMMUNITY_RULES } from "@/content/legal/fr";

export const metadata: Metadata = { title: COMMUNITY_RULES.title };

export default function Page() {
  return <LegalPage doc={COMMUNITY_RULES} />;
}
