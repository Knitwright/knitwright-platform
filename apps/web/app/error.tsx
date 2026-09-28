"use client";

import { Button } from "@/components/ui/Button";

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

/** Shown when a page fails in a way nothing else handled. The detail stays in the log. */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The page could not be shown. Your work is not affected. Try again, and if it keeps
        happening, tell us what you were doing.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-faint">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
