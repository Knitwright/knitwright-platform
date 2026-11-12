"use client";

import { ErrorState } from "@/components/ui/PageStates";

/**
 * The Products pages' error state (10 §9 "Error (page)"): what went wrong in plain words, Retry, and Contact
 * support with the request's reference. A failed read changes nothing.
 */
export default function ProductsError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <ErrorState title="The products could not be read" onRetry={reset} requestId={error.digest} className="mt-16">
      Nothing has changed. Try again, and if it keeps happening, contact support with the reference below.
    </ErrorState>
  );
}
