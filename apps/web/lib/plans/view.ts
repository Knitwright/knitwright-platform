import { PLAN_SETTINGS, type PlanId, type PlanRow, type PlanSettings } from "./catalogue";

/**
 * What the plans modal says, worked out from the config rows (decision 0144): the price for the
 * billing period chosen, what annual billing saves, and the credits line. No component computes a
 * price itself.
 */

export type Billing = "monthly" | "annual";

const MONTHS = 12;

/** "£7", "£23.50": whole pounds without pence. */
export const money = (minor: number): string => {
  const pounds = minor / 100;
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2)}`;
};

/** What a year billed annually saves against twelve monthly payments, in pence. */
export const yearlySaving = (plan: PlanRow): number => (plan.monthlyMinor - plan.annualMonthlyMinor) * MONTHS;

/** The biggest saving of the plans shown, for the "Save up to £X" pill. */
export const bestSaving = (plans: readonly PlanRow[]): number => Math.max(0, ...plans.map(yearlySaving));

/** The biggest saving as a whole percentage, for the tech pack modal's "Save up to N%". */
export const bestSavingPercent = (plans: readonly PlanRow[]): number =>
  Math.max(0, ...plans.filter((plan) => plan.monthlyMinor > 0).map((plan) => Math.round((yearlySaving(plan) / (plan.monthlyMinor * MONTHS)) * 100)));

/** The plans named, in that order, from the settings. */
export const plansOf = (ids: readonly PlanId[], settings: PlanSettings = PLAN_SETTINGS): readonly PlanRow[] =>
  ids.flatMap((id) => settings.plans.filter((plan) => plan.id === id));

export const planNamed = (id: PlanId, settings: PlanSettings = PLAN_SETTINGS): PlanRow => {
  const plan = settings.plans.find((row) => row.id === id);
  if (!plan) throw new Error(`No plan ${id} in the plan settings.`);
  return plan;
};

export interface PriceView {
  /** The price paid per month in this billing period. */
  readonly now: string;
  /** The monthly price struck through when annual billing is cheaper; null otherwise. */
  readonly was: string | null;
  readonly per: string;
  /** "Save £24 compared to monthly", or null. */
  readonly saving: string | null;
}

export function priceView(plan: PlanRow, billing: Billing): PriceView {
  if (plan.monthlyMinor === 0) return { now: money(0), was: null, per: "forever", saving: null };
  if (billing === "monthly") return { now: money(plan.monthlyMinor), was: null, per: "/mo, billed monthly", saving: null };
  const saving = yearlySaving(plan);
  return {
    now: money(plan.annualMonthlyMinor),
    was: saving > 0 ? money(plan.monthlyMinor) : null,
    per: "/mo, billed annually",
    saving: saving > 0 ? money(saving) : null,
  };
}

const count = (n: number): string => n.toLocaleString("en-GB");

/** "600 AI credits", with "/mo" for a monthly allowance, and what they make. */
export function creditsView(plan: PlanRow, settings: PlanSettings = PLAN_SETTINGS): Readonly<{ amount: string; per: string; makes: string }> {
  const images = Math.floor(plan.credits / settings.creditsPerImage);
  const videos = Math.floor(plan.credits / settings.creditsPerVideo);
  return {
    amount: `${count(plan.credits)} AI credits`,
    per: plan.creditsPerMonth ? "/mo" : "to start",
    makes: `Up to ${count(images)} images or ${count(videos)} videos`,
  };
}

/** "5 tech pack exports / month", "Unlimited tech pack exports", or null for none. */
export function techPackLine(plan: PlanRow): string | null {
  if (plan.techPackExports === 0) return null;
  if (plan.techPackExports === null) return "Unlimited tech pack exports";
  return `${count(plan.techPackExports)} tech pack exports / month`;
}

/** The current plan's name and the balance, for Settings: "Free · 1,240 credits left". */
export function currentPlanLine(credits: number | null, settings: PlanSettings = PLAN_SETTINGS): string {
  const name = planNamed(settings.currentPlan, settings).name;
  return credits === null ? name : `${name} · ${count(credits)} credits left`;
}
