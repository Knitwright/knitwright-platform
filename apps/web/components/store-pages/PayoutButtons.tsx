"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { finishTestOnboardingAction, openPayoutDashboardAction, startPayoutOnboardingAction } from "@/lib/store-pages/actions";

type Reply = Readonly<{ success: true; data: Readonly<{ url: string }> } | { success: false; error: Readonly<{ message: string }> }>;

/** Calls an action that answers an address, then goes there: Stripe's page, or the test onboarding. */
function useGo() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const go = (act: () => Promise<Reply>) =>
    start(async () => {
      const reply = await act().catch(() => null);
      if (!reply) return setProblem("Not sent. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      if (/^https?:\/\//.test(reply.data.url) && !reply.data.url.startsWith(window.location.origin)) window.location.assign(reply.data.url);
      else router.push(reply.data.url.replace(window.location.origin, "") as Route);
    });
  return { pending, problem, go };
}

const Problem = ({ text }: Readonly<{ text: string | null }>) =>
  text ? (
    <Notice tone="warn" role="alert">
      {text}
    </Notice>
  ) : null;

/** Set up payouts, finish them, or open the seller's Stripe dashboard (decision 0156). */
export function PayoutButtons({ state }: Readonly<{ state: "none" | "onboarding" | "restricted" | "active" }>) {
  const { pending, problem, go } = useGo();
  return (
    <div className="flex flex-col gap-3">
      <Problem text={problem} />
      <div className="flex flex-wrap gap-3">
        {state === "active" ? (
          <Button variant="secondary" pending={pending} onClick={() => go(() => openPayoutDashboardAction({}))}>
            Open Stripe
          </Button>
        ) : (
          <Button pending={pending} onClick={() => go(() => startPayoutOnboardingAction({}))} data-testid="payout-onboarding">
            {state === "none" ? "Set up payouts" : "Finish with Stripe"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The test onboarding's two buttons: the `account.updated` Stripe would send, signed, through the real webhook. */
export function TestOnboardingButtons({ accountId }: Readonly<{ accountId: string }>) {
  const { pending, problem, go } = useGo();
  return (
    <div className="flex flex-col gap-3">
      <Problem text={problem} />
      <div className="flex flex-wrap gap-3">
        <Button pending={pending} onClick={() => go(() => finishTestOnboardingAction({ accountId, complete: true }))} data-testid="test-onboarding-finish">
          Finish with test details
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => go(() => finishTestOnboardingAction({ accountId, complete: false }))}>
          Leave unfinished
        </Button>
      </div>
    </div>
  );
}
