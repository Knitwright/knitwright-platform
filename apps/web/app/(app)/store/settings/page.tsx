import type { Metadata } from "next";
import { SettingsView } from "@/components/store-pages/SettingsView";
import { StoreHeader } from "@/components/store-pages/StoreHeader";
import { can } from "@/lib/clubs/roles";
import { loadStoreSettings } from "@/lib/store-pages/read";
import { SETTINGS_PATH } from "@/lib/store-pages/routes";
import { euReady } from "@/lib/store-pages/settings";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Store settings" };

/** Store › Settings: GPSR and EPR (plan v6 C5, decision 0156; 09 screen 25, prototype p17). */
export default async function StoreSettingsPage() {
  const { brand } = await requireMember();
  const { settings } = await loadStoreSettings(await sessionClient(), brand.id);
  const initial = { euRpName: settings.euRpName, euRpAddress: settings.euRpAddress, euRpEmail: settings.euRpEmail, brandContact: settings.brandContact, lucidNumber: settings.lucidNumber };
  return (
    <div className="flex flex-col gap-6 pb-16">
      <StoreHeader title="Store settings" current={SETTINGS_PATH} />
      <SettingsView initial={initial} canManage={can(brand.role, "manageMembers")} euReady={euReady(settings)} />
    </div>
  );
}
