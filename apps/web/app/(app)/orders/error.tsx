"use client";

import { ErrorState } from "@/components/ui/PageStates";

/**
 * The Orders area when a read failed (10 §9 "Error (page)"): a plain explanation, Retry, and Contact
 * support with the reference. Nothing about any order changes when a read fails.
 */
export default function OrdersError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="pt-6">
      <h1 className="sr-only">Orders</h1>
      <ErrorState title="Your orders could not be read" onRetry={reset} requestId={error.digest}>
        Nothing about any order has changed. Try again, and if it keeps happening, contact support.
      </ErrorState>
    </div>
  );
}
