import type { Metadata } from "next";
import { ChannelsScreen } from "@/components/channels/ChannelsScreen";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { outcomeOf } from "@/lib/channels/outcome";
import { loadChannelsPage } from "@/lib/channels/server";
import { CHANNELS_PATH } from "@/lib/store-pages/routes";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Sales channels" };

/**
 * Store › Sales channels (09 screen 24). The tab and its header are C5's (decision 0156); the screen under them is
 * C4's (decision 0155), mounted with `heading={false}` because the Store header already names the page. This is also
 * where Shopify's install sends the browser back (`?shopify=<outcome>`).
 */
export default async function SalesChannelsPage({ searchParams }: PageProps<"/store/channels">) {
  const member = await requireMember();
  const query = await searchParams;
  const page = await loadChannelsPage(await sessionClient(), { brandId: member.brand.id, userId: member.userId, role: member.brand.role });
  return (
    <div className="flex flex-col gap-6">
      <StoreHeader title="Sales channels" current={CHANNELS_PATH} />
      <ChannelsScreen page={page} outcome={outcomeOf(query.shopify)} heading={false} />
    </div>
  );
}
