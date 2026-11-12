import type { Metadata } from "next";
import { StudioHome } from "@/components/ai-studio/StudioHome";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "AI Workflows" };

/** AI Workflows (`09` screen 3), the same screen AI Studio opens on (decision 0141). */
export default async function AiWorkflowsPage() {
  await requireMember();
  return <StudioHome />;
}
