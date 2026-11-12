"use client";

import { AreaError } from "@/components/templates/v3/AreaError";

/** The mockups could not be read (10 §9, Error). */
export default function MockupsError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <AreaError what="The mockups" onRetry={reset} {...(error.digest ? { digest: error.digest } : {})} />;
}
