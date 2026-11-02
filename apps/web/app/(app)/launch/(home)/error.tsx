"use client";

import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Shown when the launch projects could not be read. It says what is safe -- nothing on a canvas is
 * changed by a failed read -- and names the one thing to do next.
 */
export default function LaunchError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Your launch projects could not be read</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-muted">
        Nothing on any canvas has changed. Try again, and if it keeps happening, tell us what you were doing.
      </p>
      {error.digest ? <p className="font-mono text-xs text-faint">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href={"/studio" as Route} className="soft-link text-cobalt-soft">
          Back to your designs
        </Link>
      </div>
    </div>
  );
}
