import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Store" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function StorePage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Store"
      icon="store"
      heading="The store is on its way"
    >
      Team stores, storefronts, sales channels and payouts arrive with the store.
    </PlaceholderPage>
  );
}
