import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS } from "@/content/legal/fr";

export const metadata: Metadata = { title: TERMS.title };

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
