import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Marketing" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function MarketingPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Marketing"
      icon="megaphone"
      heading="Posts are made on a launch canvas today"
      action={{ href: "/launch", label: "Open launch" }}
    >
      Ad concepts and launch packs arrive here. Until then, a launch canvas makes posts from any of your designs.
    </PlaceholderPage>
  );
}
