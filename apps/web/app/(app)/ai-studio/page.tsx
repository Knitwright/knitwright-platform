import type { Metadata } from "next";
import { StudioHome } from "@/components/ai-studio/StudioHome";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "AI Studio" };

/** AI Studio opens on AI Workflows (`09` screen 2, v3.2; decision 0141). */
export default async function AiStudioPage() {
  await requireMember();
  return <StudioHome />;
}
