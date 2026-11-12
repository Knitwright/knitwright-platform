"use client";

import { Check, Info, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { KwCoin, LockMark } from "@/components/ui/Marks";
import { Tooltip } from "@/components/ui/Tooltip";
import type { PlanFeature, PlanRow } from "@/lib/plans/catalogue";
import { creditsView, priceView, techPackLine, type Billing } from "@/lib/plans/view";

/**
 * One plan in the plans modal (08 v3.4 "Choose Your Plan", e42; and s19's tech pack cards): name and
 * pill, the pitch, the grey credits box, the price, the button, the saving and the ✓/✗ list. The
 * highlighted plan has the warm gold glow and the dark button.
 */

type PlanCardProps = Readonly<{
  plan: PlanRow;
  billing: Billing;
  kind: "plans" | "techpack";
  current: boolean;
  /** The plan a ♛ gate asked for. */
  asked: boolean;
  onChoose: (plan: PlanRow) => void;
}>;

export function PlanCard({ plan, billing, kind, current, asked, onChoose }: PlanCardProps) {
  const price = priceView(plan, billing);
  const features = kind === "techpack" ? techPackFeaturesOf(plan) : plan.features;
  return (
    <article
      data-testid={`plan-${plan.id}`}
      aria-label={plan.name}
      className={cx(
        "relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border p-7",
        plan.highlighted ? "border-gold-soft bg-gradient-to-br from-bg via-bg to-gold-soft" : "border-border bg-bg",
        asked && "ring-2 ring-gold",
      )}
    >
      <header className="flex flex-col gap-2">
        <h3 className="flex flex-wrap items-center gap-3 text-h1 text-text">
          {plan.name}
          {plan.pill ? <span className="rounded-full bg-gold px-3 py-1 text-small font-bold text-navy">{plan.pill}</span> : null}
        </h3>
        <p className="text-body-lg text-text-2">{plan.pitch}</p>
      </header>
      {kind === "plans" ? <CreditsBox plan={plan} /> : null}
      <p className="flex items-end gap-2">
        {price.was ? <s className="text-h3 text-muted">{price.was}</s> : null}
        <span className="text-h1 text-text">{price.now}</span>
        <span className="pb-1 text-small leading-tight text-text-2">{price.per}</span>
      </p>
      <ChooseButton plan={plan} current={current} onChoose={onChoose} />
      {price.saving ? (
        <p className="-mt-2 text-center text-body text-text-2">
          <strong className="font-semibold text-text">Save {price.saving}</strong> compared to monthly
        </p>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {features.map((feature) => (
          <FeatureLine key={feature.label} feature={feature} lock={kind === "techpack"} />
        ))}
      </ul>
    </article>
  );
}

function techPackFeaturesOf(plan: PlanRow): readonly PlanFeature[] {
  const exports = techPackLine(plan);
  return exports ? [{ label: exports, included: true }, ...plan.techPackFeatures] : plan.techPackFeatures;
}

function CreditsBox({ plan }: Readonly<{ plan: PlanRow }>) {
  const credits = creditsView(plan);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-soft p-4">
      <p className="flex items-center gap-2 text-body-lg">
        <KwCoin />
        <strong className="font-bold text-text">{credits.amount}</strong>
        <span className="text-muted">{credits.per}</span>
        <Tooltip content="Credits pay for AI images, videos and paid exports. Credits used on a design come back as order credit.">
          <button type="button" className="ml-auto inline-flex rounded-xs text-muted" aria-label="About credits">
            <Icon icon={Info} size={16} />
          </button>
        </Tooltip>
      </p>
      <p className="text-small text-text-2">{credits.makes}</p>
    </div>
  );
}

function ChooseButton({ plan, current, onChoose }: Readonly<{ plan: PlanRow; current: boolean; onChoose: (plan: PlanRow) => void }>) {
  if (current) {
    return (
      <Button variant="secondary" size="lg" disabledReason="You are on this plan" className="w-full">
        Current plan
      </Button>
    );
  }
  return (
    <Button variant={plan.highlighted ? "primary" : "secondary"} size="lg" className="w-full" onClick={() => onChoose(plan)}>
      Get {plan.name}
    </Button>
  );
}

function FeatureLine({ feature, lock }: Readonly<{ feature: PlanFeature; lock: boolean }>) {
  return (
    <li className={cx("flex items-center gap-3 text-body", feature.included ? "text-text" : "text-muted")}>
      {feature.included ? (
        <Icon icon={Check} size={16} className="text-link" />
      ) : lock ? (
        <LockMark label="Locked" />
      ) : (
        <Icon icon={X} size={16} />
      )}
      <span className="sr-only">{feature.included ? "Included: " : "Not included: "}</span>
      {feature.label}
    </li>
  );
}
