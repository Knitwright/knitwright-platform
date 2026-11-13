"use client";

import { useState, useTransition } from "react";
import { goToPlanCheckout } from "@/components/payments/plan-checkout";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { Segmented } from "@/components/ui/Tabs";
import { CHECKOUT_OPENING, PLAN_PLACEHOLDER_NOTICE, PLAN_SETTINGS, type PlanId, type PlanRow, type PlanSettings } from "@/lib/plans/catalogue";
import type { PlansKind } from "@/lib/plans/modal-store";
import { bestSaving, bestSavingPercent, money, plansOf, type Billing } from "@/lib/plans/view";
import { PlanCard } from "./PlanCard";

/**
 * The plans modal (decision 0144). Two faces of one set of config rows:
 *
 * - "plans": **Choose Your Plan** (08 v3.4, e42): Monthly | Annual with "Save up to £X", Starter,
 *   Studio Pro and Club & Scale, and the footnote that design is free.
 * - "techpack": **Upgrade to export tech packs** (09 screen 29, s19): Monthly | Yearly, Free,
 *   Starter and Studio Pro with their tech pack export limits, and the note that ordering through
 *   Knitwright needs no export.
 *
 * Choosing a plan opens its Stripe Billing checkout (plan v6 C1, decision 0152) through
 * `goToPlanCheckout`, the one entry point every upgrade button uses.
 */

type PlansModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  kind: PlansKind;
  /** The plan a ♛ gate asked for, ringed. */
  asked?: PlanId | null;
  settings?: PlanSettings;
  /** Start on this billing period. Annual by default, as Kittl does. */
  initialBilling?: Billing;
}>;

const COPY: Readonly<Record<PlansKind, Readonly<{ title: string; annual: string; footnote: string }>>> = {
  plans: {
    title: "Choose Your Plan",
    annual: "Annual",
    footnote: "Designing, 3D views, quotes and the tech pack summary are always free. Credits spent on a design come back as order credit when you order it.",
  },
  techpack: {
    title: "Upgrade to export tech packs",
    annual: "Yearly",
    footnote: "Ordering from Knitwright? The tech pack goes to our factory free. You only need an export to make it somewhere else.",
  },
};

export function PlansModal({ open, onClose, kind, asked = null, settings = PLAN_SETTINGS, initialBilling = "annual" }: PlansModalProps) {
  const [billing, setBilling] = useState<Billing>(kind === "techpack" ? "monthly" : initialBilling);
  const [chosen, setChosen] = useState<PlanRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [, start] = useTransition();
  const choose = (plan: PlanRow) => {
    setChosen(plan);
    setProblem(null);
    start(async () => setProblem(await goToPlanCheckout(plan.id, billing)));
  };
  const plans = plansOf(kind === "techpack" ? settings.techPackPlans : settings.choosePlans, settings);
  const copy = COPY[kind];
  const pill = kind === "plans" ? `Save up to ${money(bestSaving(plans))}` : null;

  return (
    <Modal open={open} onClose={onClose} title={copy.title} size="sheet">
      <div className="flex flex-col items-center gap-6" data-testid={`plans-modal-${kind}`}>
        <Segmented
          label="Billing period"
          value={billing}
          onChange={(id) => setBilling(id as Billing)}
          className="h-12"
          options={[
            { id: "monthly", label: "Monthly" },
            {
              id: "annual",
              label: (
                <span className="flex items-center gap-2">
                  {copy.annual}
                  {pill ? <span className="rounded-full bg-link px-2 py-0.5 text-caption font-bold text-on-dark">{pill}</span> : null}
                </span>
              ),
            },
          ]}
        />
        {kind === "techpack" ? (
          <p className="-mt-2 text-body text-text">
            <strong className="font-bold">Save up to {bestSavingPercent(plans)}%</strong> on yearly
          </p>
        ) : null}
        {chosen ? (
          <div className="w-full" data-testid="plans-checkout">
            <Notice tone={problem ? "warn" : "info"} role={problem ? "alert" : "status"}>
              <strong className="font-semibold">{chosen.name}.</strong> {problem ?? CHECKOUT_OPENING}
            </Notice>
          </div>
        ) : null}
        <div className="grid w-full gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              kind={kind}
              current={plan.id === settings.currentPlan}
              asked={plan.id === asked}
              onChoose={choose}
            />
          ))}
        </div>
        <p className="text-center text-small text-muted">
          {copy.footnote} {settings.isPlaceholder ? PLAN_PLACEHOLDER_NOTICE : null}
        </p>
      </div>
    </Modal>
  );
}
