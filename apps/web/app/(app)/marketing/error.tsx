"use client";

import { AreaError } from "@/components/templates/v3/AreaError";

/** The marketing concepts could not be read (10 §9, Error). */
export default function MarketingError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <AreaError what="The marketing concepts" onRetry={reset} {...(error.digest ? { digest: error.digest } : {})} />;
}
