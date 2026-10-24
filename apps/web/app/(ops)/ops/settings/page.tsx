import type { Metadata } from "next";
import { SettingsForm } from "@/components/ops/SettingsForm";
import { loadSettings } from "@/lib/ops/service";
import { sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: settings", robots: { index: false, follow: false } };

/** The weekly cut-off and the lead time. Platform admins only. */
export default async function OpsSettingsPage() {
  await requirePlatformAdmin();
  const settings = await loadSettings(await sessionClient());
  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-2 text-[15px] text-muted">Current source: {settings.label}. Times are UTC. A change applies to orders submitted after it; orders already submitted keep the cut-off and date they were given.</p>
      <div className="mt-6"><SettingsForm settings={settings} /></div>
    </main>
  );
}
