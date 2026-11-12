import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { requireMember } from "@/lib/server/page-guards";
import { ORDERS_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "Orders" };

/** A placeholder of the v3.9 route map (decision 0138): its page is built by a later workstream. */
export default async function OrdersPage() {
  await requireMember();
  return (
    <PlaceholderPage
      title="Orders"
      icon="truck"
      heading="Your orders will be listed here"
      action={{ href: "/orders/runs", label: "Open product runs" }}
      tabs={{ label: "Orders", items: ORDERS_TABS }}
    >
      Samples and runs are planned on Product runs today, and each one shows where its order is.
    </PlaceholderPage>
  );
}
