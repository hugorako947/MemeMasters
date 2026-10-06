import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_NOTICE } from "@/content/legal/fr";

export const metadata: Metadata = { title: LEGAL_NOTICE.title };

export default function Page() {
  return <LegalPage doc={LEGAL_NOTICE} />;
}
