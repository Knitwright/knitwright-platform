"use client";

import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** Shown when a project's canvas could not be read or a change could not be saved (decision 0145). */
export default function ProjectCanvasError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 text-text">This project could not be opened</h1>
      <p className="max-w-xl text-body-lg text-muted">
        No board and no design has been changed, and nothing has been charged. Try again, and if it keeps happening, open your projects and tell
        us which one it was.
      </p>
      {error.digest ? <p className="font-mono text-caption text-muted">Reference: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href={"/projects" as Route} className="text-electric underline-offset-2 hover:underline">
          Your projects
        </Link>
      </div>
    </div>
  );
}
