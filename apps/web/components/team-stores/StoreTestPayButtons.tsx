"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { finishStoreTestCheckoutAction } from "@/lib/team-stores/actions";

/**
 * The store's test checkout buttons (decision 0153, on C1's test checkout): each makes the event Stripe would send,
 * signed, hands it to C1's webhook, and goes where Stripe would send the buyer back to.
 */
export function StoreTestPayButtons({ code, sessionId }: Readonly<{ code: string; sessionId: string }>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const finish = (outcome: "paid" | "expired") =>
    start(async () => {
      const reply = await finishStoreTestCheckoutAction({ code, sessionId, outcome }).catch(() => null);
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
        <Button pending={pending} onClick={() => finish("paid")} data-testid="store-test-pay">
          Pay with a test card
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => finish("expired")}>
          Cancel and go back
        </Button>
      </div>
    </div>
  );
}
