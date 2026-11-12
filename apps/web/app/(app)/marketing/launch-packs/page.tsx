import { Layers } from "lucide-react";
import type { Metadata } from "next";
import { StartLaunch } from "@/components/launch-start/StartLaunch";
import { MARKETING_TABS } from "@/components/marketing/v3/MarketingView";
import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { Tag } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { FLOW_TEMPLATES } from "@/lib/flows/templates";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Launch packs" };

/**
 * Plan a launch pack (09 screen 9, F-L4; decision 0140): the six flow packs of `07`. Planning one
 * opens a new launch canvas with the pack's boards and connectors laid out from the brand's newest
 * design. Nothing runs and nothing is charged until Run all, which shows the cost first.
 */
export default async function LaunchPacksPage() {
  await requireMember();
  return (
    <div className="flex flex-col gap-6 pt-4">
      <TopBarTabs label="Marketing" tabs={MARKETING_TABS} />
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-text">Launch packs</h1>
        <p className="text-body-lg text-muted">One design becomes a whole launch. A pack lays out every board; nothing runs until you press Run all.</p>
      </div>
      <ul aria-label="Launch packs" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {FLOW_TEMPLATES.map((pack) => (
          <li key={pack.slug}>
            <article aria-labelledby={`pack-${pack.slug}`} className="flex h-full flex-col gap-4 rounded-xl border border-border bg-bg p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-soft text-text-2">
                  <Icon icon={Layers} size={20} />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id={`pack-${pack.slug}`} className="text-title text-text">
                    {pack.title}
                  </h2>
                  <p className="text-body text-muted">{pack.lead}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="info">{pack.assets} assets</Tag>
                {pack.sections.map((section) => (
                  <Tag key={section}>{section}</Tag>
                ))}
              </div>
              <StartLaunch source="flow" slug={pack.slug} variant="primary" size="md" label={`Plan this pack: ${pack.title}`} className="mt-auto">
                Plan this pack
              </StartLaunch>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
