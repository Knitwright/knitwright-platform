"use client";

import { ErrorState } from "@/components/ui/PageStates";

/**
 * The page error of 10 §9 for the Templates, Mockups and Marketing pages: a plain explanation,
 * Retry, and Contact support with the request's reference. Nothing the person made is changed by a
 * failed read, and it says so.
 */
export function AreaError({ what, digest, onRetry }: Readonly<{ what: string; digest?: string; onRetry: () => void }>) {
  return (
    <>
      <h1 className="sr-only">{what}</h1>
      <ErrorState title={`${what} could not be read`} onRetry={onRetry} {...(digest ? { requestId: digest } : {})} className="mt-16">
        Nothing you made has changed. Try again, and if it keeps happening, tell us what you were doing.
      </ErrorState>
    </>
  );
}
