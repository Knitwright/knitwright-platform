import type { Metadata } from "next";
import { ChannelsPanel } from "@/components/store-pages/ChannelsSlot";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { CHANNELS_PATH } from "@/lib/store-pages/routes";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Sales channels" };

/**
 * Store › Sales channels (09 screen 24, prototype p15). The tab is C5's (decision 0156); what it shows is the
 * channels workstream's (C4, decision 0155), through the one-line slot in `ChannelsSlot.tsx`.
 */
export default async function StoreChannelsPage() {
  await requireMember();
  return (
    <div className="flex flex-col gap-8 pb-16">
      <StoreHeader title="Sales channels" current={CHANNELS_PATH} />
      <ChannelsPanel />
    </div>
  );
}
