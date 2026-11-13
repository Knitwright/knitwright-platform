"use client";

import { ErrorState } from "@/components/ui/PageStates";

/**
 * The Store when a read failed (10 §9 "Error (page)"): a plain explanation, Retry, and Contact support with the
 * reference. No sale or payout changes when a read fails.
 */
export default function StoreError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="pt-6">
      <h1 className="sr-only">Store</h1>
      <ErrorState title="Your store could not be read" onRetry={reset} requestId={error.digest}>
        No sale or payout has changed. Try again, and if it keeps happening, contact support.
      </ErrorState>
    </div>
  );
}
