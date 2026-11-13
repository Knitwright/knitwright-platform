"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { finishTestCheckoutAction } from "@/lib/payments/actions";

/**
 * The test checkout's two buttons (decision 0152). Each makes the event Stripe would send, signed, and hands it to
 * the real webhook; then the page goes where Stripe would send the person back to.
 */
export function TestCheckoutButtons({ sessionId }: Readonly<{ sessionId: string }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const finish = (outcome: "paid" | "expired") =>
    start(async () => {
      const reply = await finishTestCheckoutAction({ sessionId, outcome }).catch(() => null);
      if (!reply) return setProblem("The test payment could not be sent. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      router.push(reply.data.url as Route);
    });

  return (
    <div className="flex flex-col gap-3">
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button pending={pending} onClick={() => finish("paid")} data-testid="test-checkout-pay">
          Pay with a test card
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => finish("expired")}>
          Cancel and go back
        </Button>
      </div>
    </div>
  );
}
