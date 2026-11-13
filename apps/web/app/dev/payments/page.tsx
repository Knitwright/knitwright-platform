import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BuyCredits } from "@/components/payments/BuyCredits";
import { FigureCard, PaymentList } from "@/components/payments/ops/FinanceView";
import { PaymentSettingsForm } from "@/components/payments/ops/FinanceForms";
import { AppShell } from "@/components/shell/AppShell";
import { PageIntro } from "@/components/shell/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { CREDIT_PACK_LABEL, creditPacks } from "@/lib/payments/billing";
import { DEFAULT_SETTINGS } from "@/lib/payments/fixtures/memory-store";
import type { PaymentRow } from "@/lib/payments/store";
import { amountLine, headlineOf } from "@/lib/payments/view";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Payments screens", robots: { index: false, follow: false } };

/**
 * C1's screens with made-up payments (decision 0152), without a database: `?screen=` picks return (every state of
 * the page Stripe sends people back to), credits (Get more credits) or finance (the ops F-G4 page). A production
 * build answers 404 unless DEV_UI_ROUTES is "on".
 */

const SCREENS = ["return", "credits", "finance"] as const;

const payment = (over: Partial<PaymentRow>): PaymentRow => ({
  id: "00000000-0000-4000-8000-000000000001", brandId: "b", purpose: "order", method: "card", status: "fulfilled", currency: "GBP",
  orderValueMinor: 8700, amountMinor: 8700, schedule: "full", balanceDueMinor: 0, refundedMinor: 0, provider: "test", sessionId: "cs",
  providerPaymentId: "pi", credits: null, planId: null, planInterval: null, description: "Sample of Home shirt", createdBy: "u", createdAt: "2026-11-13T10:00:00Z", ...over,
});

const STATES: readonly Readonly<{ payment: PaymentRow; cancelled: boolean }>[] = [
  { payment: payment({}), cancelled: false },
  { payment: payment({ status: "open" }), cancelled: false },
  { payment: payment({ status: "open" }), cancelled: true },
  { payment: payment({ schedule: "deposit", orderValueMinor: 300_000, amountMinor: 120_000, balanceDueMinor: 180_000, description: "Run of Home shirt" }), cancelled: false },
  { payment: payment({ method: "invoice", status: "invoice", orderValueMinor: null, amountMinor: 0, provider: null }), cancelled: false },
  { payment: payment({ status: "refunded", refundedMinor: 8700 }), cancelled: false },
];

function Return() {
  return (
    <div className="flex flex-col gap-8 pt-4">
      {STATES.map(({ payment: row, cancelled }, index) => {
        const headline = headlineOf(row, cancelled);
        return (
          <section key={index} className="flex max-w-2xl flex-col gap-3">
            <PageIntro eyebrow={row.description} title={headline.title} lead={amountLine(row)} />
            <Notice tone={headline.tone}>{headline.body}</Notice>
          </section>
        );
      })}
    </div>
  );
}

const FIGURES = { currency: "GBP" as const, gmvMinor: 1_250_000, collectedMinor: 980_000, refundedMinor: 30_000, revenueMinor: 950_000, openPreOrderMinor: 700_000, reserveMinor: 70_000, depositsMinor: 400_000, headroomMinor: 480_000, reserveBps: 1000 };

function Finance() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <FigureCard figures={FIGURES} />
      <FigureCard figures={{ ...FIGURES, currency: "AUD", gmvMinor: 0, collectedMinor: 0, refundedMinor: 0, revenueMinor: 0, openPreOrderMinor: 0, reserveMinor: 0, depositsMinor: 0, headroomMinor: 0 }} />
      <PaymentSettingsForm settings={DEFAULT_SETTINGS} />
      <PaymentList payments={STATES.map((one) => one.payment)} />
      <PaymentList payments={[]} />
    </div>
  );
}

function Credits() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <BuyCredits packs={creditPacks()} canBuy label={CREDIT_PACK_LABEL} />
      <BuyCredits packs={creditPacks()} canBuy={false} label={CREDIT_PACK_LABEL} />
      <BuyCredits packs={[]} canBuy label={CREDIT_PACK_LABEL} />
    </div>
  );
}

const BODY = { return: Return, credits: Credits, finance: Finance } as const;

export default async function DevPaymentsPage({ searchParams }: PageProps<"/dev/payments">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).screen;
  const Body = BODY[SCREENS.find((entry) => entry === asked) ?? "return"];
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Brand", workspace: { isClub: true, setUp: false }, credits: 1240 }}>
      <Body />
    </AppShell>
  );
}
