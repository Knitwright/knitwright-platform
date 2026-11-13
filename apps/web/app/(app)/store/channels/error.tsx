"use client";

import { ErrorState } from "@/components/ui/PageStates";

/** Sales channels could not be read (10 §9): say so, and offer to try again. */
export default function SalesChannelsError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <div className="pt-4">
      <ErrorState title="Your sales channels could not be loaded" onRetry={reset}>
        Nothing was changed. Try again in a moment.
      </ErrorState>
    </div>
  );
}
