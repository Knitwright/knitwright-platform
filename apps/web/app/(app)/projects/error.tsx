"use client";

import { ErrorState } from "@/components/ui/PageStates";

/**
 * Shown when a Projects list could not be read (10 §9, Error (page)). A failed read changes
 * nothing, so it says so, offers Retry, and gives the request's reference to quote to support.
 */
export default function ProjectsError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <ErrorState title="Your projects could not be read" onRetry={reset} requestId={error.digest} className="pt-20">
      Nothing in any project has changed. Try again, and if it keeps happening, contact support.
    </ErrorState>
  );
}
