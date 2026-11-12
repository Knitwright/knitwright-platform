import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "Workflow" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function AiWorkflowPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Workflow"
      icon="sparkle"
      heading="This workflow is not built yet"
      action={{ href: "/ai-studio", label: "Back to AI Studio" }}
      tabs={{ label: "AI Studio", items: AI_STUDIO_TABS }}
    >
      Each workflow gets its own page with AI Studio. Until then, start from the list of workflows.
    </PlaceholderPage>
  );
}
