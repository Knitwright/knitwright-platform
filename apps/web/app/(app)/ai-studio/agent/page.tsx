import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "Creative Agent" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function CreativeAgentPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Creative Agent"
      icon="sparkle"
      heading="The Creative Agent is on its way"
      action={{ href: "/projects", label: "Open your projects" }}
      tabs={{ label: "AI Studio", items: AI_STUDIO_TABS }}
    >
      Until it arrives, ask about a design from the Ask panel inside the editor.
    </PlaceholderPage>
  );
}
