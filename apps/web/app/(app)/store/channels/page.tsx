import type { Metadata } from "next";
import { ChannelsScreen } from "@/components/channels/ChannelsScreen";
import { outcomeOf } from "@/lib/channels/outcome";
import { loadChannelsPage } from "@/lib/channels/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Sales channels" };

/**
 * Sales channels (09 screen 24; plan v6 C4, decision 0155). C5's Store pages host the same screen as their
 * Channels tab (`components/channels/ChannelsScreen.tsx`); this route is its own address, and where Shopify's
 * install sends the browser back (`?shopify=<outcome>`).
 */
export default async function SalesChannelsPage({ searchParams }: PageProps<"/store/channels">) {
  const member = await requireMember();
  const query = await searchParams;
  const page = await loadChannelsPage(await sessionClient(), { brandId: member.brand.id, userId: member.userId, role: member.brand.role });
  return <ChannelsScreen page={page} outcome={outcomeOf(query.shopify)} />;
}
