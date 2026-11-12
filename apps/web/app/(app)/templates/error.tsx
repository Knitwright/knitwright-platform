"use client";

import { AreaError } from "@/components/templates/v3/AreaError";

/** The library could not be read (10 §9, Error). */
export default function TemplatesError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <AreaError what="The templates" onRetry={reset} {...(error.digest ? { digest: error.digest } : {})} />;
}
