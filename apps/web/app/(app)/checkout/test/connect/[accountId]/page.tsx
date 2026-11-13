import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TestOnboardingButtons } from "@/components/store-pages/PayoutButtons";
import { PageIntro } from "@/components/shell/PageIntro";
import { Notice } from "@/components/ui/Notice";
import { isTestAccount } from "@/lib/store-pages/connect";
import { connect } from "@/lib/store-pages/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Test payout onboarding", robots: { index: false, follow: false } };

/**
 * THE TEST ONBOARDING (plan v6 C5, decision 0156): where Stripe's Connect onboarding would be, on a deploy with the
 * test checkout on (the browser tests, a local run). Anywhere else, and for another brand's account, the page does
 * not exist. The account is read with the member's own client, so the database decides who sees it.
 */
export default async function TestOnboardingPage({ params }: PageProps<"/checkout/test/connect/[accountId]">) {
  await requireMember();
  const { accountId } = await params;
  if (connect()?.provider.name !== "test" || !isTestAccount(accountId)) notFound();
  const { data } = await (await sessionClient()).from("seller_accounts").select("provider_account_id").eq("provider_account_id", accountId).maybeSingle();
  if (!data) notFound();

  return (
    <main id="main" className="flex flex-col">
      <div className="flex max-w-2xl flex-col gap-6">
        <PageIntro eyebrow="Test onboarding" title="Payouts with Stripe" lead="Give Stripe your details to be paid your margin weekly, after delivery." />
        <Notice tone="info">This is the test onboarding. No details are sent and no money moves. On a deploy with Stripe Connect set up, this is Stripe&apos;s own page.</Notice>
        <TestOnboardingButtons accountId={accountId} />
      </div>
    </main>
  );
}
