import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/content/legal/fr";

export const metadata: Metadata = { title: PRIVACY.title };

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
