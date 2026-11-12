"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { shareQcPhotosAction } from "@/lib/ops/qc/actions";

type Props = Readonly<{ orderId: string; inspectionId: string; shared: boolean }>;

/**
 * Whether the customer sees a passing inspection's photos on their order page (decision 0143). Photos
 * are hidden until ops shares them, and can be hidden again.
 */
export function ShareQcPhotos({ orderId, inspectionId, shared }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    setProblem(null);
    start(async () => {
      const reply = await shareQcPhotosAction({ orderId, inspectionId, shared: !shared }).catch(() => null);
      if (!reply) return setProblem("That could not be saved. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="text-muted">{shared ? "The customer sees these photos." : "The customer does not see these photos."}</span>
      <Button type="button" variant="secondary" size="sm" pending={pending} onClick={toggle}>
        {shared ? "Hide photos from the customer" : "Show photos to the customer"}
      </Button>
      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}
    </span>
  );
}
