import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Mockups" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function MockupsPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Mockups"
      icon="shirt"
      heading="Mockups are made on a launch canvas today"
      action={{ href: "/launch", label: "Open launch" }}
    >
      The mockup generator arrives here. Until then, a launch canvas makes mockups of any of your designs.
    </PlaceholderPage>
  );
}
