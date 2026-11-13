import { SizeGuideTable } from "@/components/signup/SizeGuideTable";
import { brandChartSet } from "@/lib/charts/service";
import { guideForWearer } from "@/lib/clubs/signup/size-guide";
import { WEARER_GROUPS, WEARER_LABELS } from "@/lib/clubs/wording";
import { adminClient } from "@/lib/server/deps";

/**
 * The club's size guide on its public pages (spec F-T6 "size guide"; decision 0153): one folded table per cut, from
 * the club's own size charts, or Knitwright's starter chart with a line saying so. The sign-up page's own guide
 * (decision 0087), so a parent reads the same numbers wherever they meet them.
 */
export async function SizeGuides({ brandId }: Readonly<{ brandId: string }>) {
  const charts = await brandChartSet(adminClient(), brandId);
  return (
    <div className="flex flex-col gap-2" data-testid="size-guides">
      {WEARER_GROUPS.map((group) => (
        <details key={group} className="rounded-lg border border-border">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-small font-semibold text-text">Size guide · {WEARER_LABELS[group]}</summary>
          <div className="border-t border-border p-3">
            <SizeGuideTable guide={guideForWearer(charts, group)} label={WEARER_LABELS[group]} />
          </div>
        </details>
      ))}
    </div>
  );
}
