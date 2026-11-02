"use client";

import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** Shown when a launch canvas could not be read or a change could not be saved. */
export default function LaunchProjectError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">This launch canvas could not be opened</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-muted">
        No board has been changed, and nothing has been charged. Try again, and if it keeps happening, open your launch projects and
        tell us which canvas it was.
      </p>
      {error.digest ? <p className="font-mono text-xs text-faint">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href={"/launch" as Route} className="soft-link text-cobalt-soft">
          Your launch projects
        </Link>
      </div>
    </div>
  );
}
