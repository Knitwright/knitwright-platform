import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "Video Generator" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function VideoGeneratorPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Video Generator"
      icon="sparkle"
      heading="Clips are made on a launch canvas today"
      action={{ href: "/launch", label: "Open launch" }}
      tabs={{ label: "AI Studio", items: AI_STUDIO_TABS }}
    >
      The video generator arrives with AI Studio. A launch canvas already makes clips of any design.
    </PlaceholderPage>
  );
}
