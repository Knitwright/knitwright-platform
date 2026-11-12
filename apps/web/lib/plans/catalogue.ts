/**
 * The plans and their prices (spec 08 v3.4 "Choose Your Plan", 09 screen 29, plan v6 P6, decision
 * 0144). EVERY NUMBER HERE IS A PLACEHOLDER, NOT A PRICE.
 *
 * The owner has not set plan prices (decision 0131, owner action "plan prices"). These rows only let
 * the plans modal be drawn and tested; they are the prototype's numbers, labelled. They are data in
 * one place, as plan v5's "data, not constants" asks, so no component holds a price. When C1 brings
 * Stripe Billing, its prices replace these rows and `isPlaceholder` goes false.
 *
 * Nothing here is bought. The modal's choose button says checkout is coming and records nothing.
 */

export type PlanId = "free" | "starter" | "studio_pro" | "club_scale";

export interface PlanFeature {
  readonly label: string;
  /** False draws ✗ (or 🔒 in the tech pack modal): the plan does not include it. */
  readonly included: boolean;
}

export interface PlanRow {
  readonly id: PlanId;
  readonly name: string;
  /** The pill beside the name ("Best for brands"), or null. */
  readonly pill: string | null;
  readonly pitch: string;
  /** Monthly price in pence. */
  readonly monthlyMinor: number;
  /** Price per month when billed annually, in pence. */
  readonly annualMonthlyMinor: number;
  /** AI credits each month; for Free, the credits it starts with. */
  readonly credits: number;
  readonly creditsPerMonth: boolean;
  /** Tech pack exports a month. 0 means none (🔒); null means no limit. */
  readonly techPackExports: number | null;
  readonly features: readonly PlanFeature[];
  /** The features the tech pack upgrade modal lists for this plan (09 screen 29). */
  readonly techPackFeatures: readonly PlanFeature[];
  /** The plan with the gold glow and the dark button. */
  readonly highlighted: boolean;
}

export interface PlanSettings {
  readonly isPlaceholder: boolean;
  readonly currency: "GBP";
  /** Every brand is on this plan until C1 records a subscription. */
  readonly currentPlan: PlanId;
  /** What one generated image and one generated video use, for "Up to N images or M videos". */
  readonly creditsPerImage: number;
  readonly creditsPerVideo: number;
  /** The plans the Choose Your Plan modal shows, in order. */
  readonly choosePlans: readonly PlanId[];
  /** The plans the tech pack upgrade modal shows, in order. */
  readonly techPackPlans: readonly PlanId[];
  readonly plans: readonly PlanRow[];
}

const yes = (label: string): PlanFeature => ({ label, included: true });
const no = (label: string): PlanFeature => ({ label, included: false });

export const PLAN_SETTINGS: PlanSettings = {
  isPlaceholder: true,
  currency: "GBP",
  currentPlan: "free",
  creditsPerImage: 5,
  creditsPerVideo: 100,
  choosePlans: ["starter", "studio_pro", "club_scale"],
  techPackPlans: ["free", "starter", "studio_pro"],
  plans: [
    {
      id: "free",
      name: "Free",
      pill: null,
      pitch: "Try it out.",
      monthlyMinor: 0,
      annualMonthlyMinor: 0,
      credits: 300,
      creditsPerMonth: false,
      techPackExports: 0,
      features: [yes("Every base article and 3D view"), yes("Tech pack sent free with every order"), no("Tech pack export"), no("High-res exports")],
      techPackFeatures: [yes("Up to 3 designs"), yes("Editor and Garment Studio"), yes("Tech pack sent free with every order"), no("Tech pack export"), no("High-res exports")],
      highlighted: false,
    },
    {
      id: "starter",
      name: "Starter",
      pill: null,
      pitch: "Get your first kit designs and product shots right",
      monthlyMinor: 900,
      annualMonthlyMinor: 700,
      credits: 600,
      creditsPerMonth: true,
      techPackExports: 5,
      features: [no("Bonus daily credits"), yes("Every base article and 3D view"), yes("Standard image models"), no("Custom store domain")],
      techPackFeatures: [yes("Range plan (1 board)"), yes("Repeat print maker"), yes("High-res exports"), yes("Artwork print files")],
      highlighted: false,
    },
    {
      id: "studio_pro",
      name: "Studio Pro",
      pill: "Best for brands",
      pitch: "Weekly drops, listings and product shots, with your own store",
      monthlyMinor: 2900,
      annualMonthlyMinor: 2300,
      credits: 2400,
      creditsPerMonth: true,
      techPackExports: 30,
      features: [yes("100 bonus daily credits"), yes("Custom store domain"), yes("Knitwright branding removed"), yes("Up to 15% off base prices")],
      techPackFeatures: [yes("Everything in Starter"), yes("Unlimited designs"), yes("Unlimited range plans"), yes("Unlimited brand kits")],
      highlighted: true,
    },
    {
      id: "club_scale",
      name: "Club & Scale",
      pill: null,
      pitch: "Clubs, academies and brands producing at volume",
      monthlyMinor: 7900,
      annualMonthlyMinor: 6300,
      credits: 8000,
      creditsPerMonth: true,
      techPackExports: null,
      features: [yes("300 bonus daily credits"), yes("5 seats and team stores"), yes("Fundraising margin paid to the club"), yes("Priority sample slot")],
      techPackFeatures: [yes("Everything in Studio Pro"), yes("5 seats and team stores")],
      highlighted: false,
    },
  ],
};

export const PLAN_PLACEHOLDER_NOTICE = "Prices are placeholders.";
export const CHECKOUT_COMING =
  "Checkout is coming soon. Nothing has been charged and nothing is recorded: you stay on your current plan.";
