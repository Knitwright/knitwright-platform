import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "AI Workflows" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function AiWorkflowsPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="AI Workflows"
      icon="sparkle"
      heading="AI workflows are on their way"
      action={{ href: "/crest-to-kit", label: "Open crest to kit" }}
      tabs={{ label: "AI Studio", items: AI_STUDIO_TABS }}
    >
      Crest to kit already builds validated kits from your crest and colours. The other workflows arrive with AI Studio.
    </PlaceholderPage>
  );
}
