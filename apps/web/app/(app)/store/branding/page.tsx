import type { Metadata } from "next";
import { BrandingCards, StorefrontLook } from "@/components/store-pages/BrandingView";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { Notice } from "@/components/ui/Notice";
import { can } from "@/lib/clubs/roles";
import { loadStoreSettings } from "@/lib/store-pages/read";
import { BRANDING_PATH } from "@/lib/store-pages/routes";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Branding" };

/** Store › Branding (plan v6 C5, decision 0156; 09 screen 25, prototype p18). */
export default async function StoreBrandingPage() {
  const { brand } = await requireMember();
  const { settings, options } = await loadStoreSettings(await sessionClient(), brand.id);
  const canManage = can(brand.role, "manageMembers");
  return (
    <div className="flex flex-col gap-6 pb-16">
      <StoreHeader title="Branding" current={BRANDING_PATH} />
      <StorefrontLook />
      {canManage ? null : <Notice tone="info">Only owners and admins change what goes in each parcel.</Notice>}
      <BrandingCards options={options} settings={settings} canManage={canManage} />
    </div>
  );
}
