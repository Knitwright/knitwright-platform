"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { finishShopTestCheckoutAction } from "@/lib/storefront/actions";

/**
 * The storefront's test checkout buttons (decision 0154, after C1's 0152): each makes the event Stripe would send,
 * signed, and hands it to the real webhook; then the page goes where Stripe would send the shopper back to.
 */
export function ShopTestPay({ slug, sessionId, orderId, token }: Readonly<{ slug: string; sessionId: string; orderId: string; token: string }>) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const finish = (outcome: "paid" | "expired") =>
    start(async () => {
      const reply = await finishShopTestCheckoutAction({ slug, sessionId, orderId, token, outcome }).catch(() => null);
      if (!reply) return setProblem("The test payment could not be sent. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      window.location.assign(reply.data.url);
    });
  return (
    <div className="flex flex-col gap-3">
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button pending={pending} onClick={() => finish("paid")} data-testid="shop-test-pay">
          Pay with a test card
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => finish("expired")}>
          Cancel and go back
        </Button>
      </div>
    </div>
  );
}
