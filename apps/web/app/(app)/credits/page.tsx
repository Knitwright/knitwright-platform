import type { Metadata } from "next";
import { CreditHistory } from "@/components/credits/CreditHistory";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { OUTPUT_KINDS, OUTPUT_LABELS } from "@/lib/credits/kinds";
import { creditSummaryFor } from "@/lib/credits/server";
import { PLACEHOLDER_NOTICE } from "@/lib/credits/settings";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Credits" };

export default async function CreditsPage() {
  const { brand } = await requireMember();
  const summary = await creditSummaryFor(brand.id);

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={brand.name}
        title="Credits"
        lead="Designing, saved versions, 3D views, the team store hand-off and the tech pack summary are free. Marketing media, the full tech pack PDF and pattern files will use credits. Credits used on a design come back when that design is ordered."
      />

      <PageSection id="balance" title="Balance" description={`Every brand gets ${summary.monthlyAllowance} free credits at the start of each month (UTC).`}>
        <p className="text-4xl font-semibold tabular-nums text-ink" data-testid="credit-balance-figure">
          {summary.balance} <span className="text-base font-normal text-muted">credits</span>
        </p>
      </PageSection>

      <PageSection
        id="prices"
        title="What uses credits"
        description={summary.isPlaceholder ? PLACEHOLDER_NOTICE : undefined}
      >
        <ul className="flex flex-col gap-2 text-[15px]">
          {OUTPUT_KINDS.map((kind) => (
            <li key={kind} className="flex justify-between gap-4">
              <span>{OUTPUT_LABELS[kind]}</span>
              <span className="tabular-nums">
                {summary.prices[kind]} {summary.prices[kind] === 1 ? "credit" : "credits"}
                {summary.isPlaceholder ? " (placeholder)" : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Nothing uses credits yet. These exports are still free while credits are being set up.</p>
      </PageSection>

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-base font-semibold text-ink">History</h2>
        <CreditHistory rows={summary.history} brandName={brand.name} />
      </section>
    </div>
  );
}
