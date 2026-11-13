import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * Focused mode (decision 0145): a Garment board opened for editing, in place on its canvas. The
 * canvas's address stays; `?focus=` says which board is open, and "Back to canvas" takes it off.
 * Until E3 rebuilds the garment inspector this is the existing editor, whole, so every studio panel
 * keeps its door.
 */
export function FocusedGarment({ backHref, canvasName, children }: Readonly<{ backHref: Route; canvasName: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-3" data-testid="canvas-focus">
      <nav aria-label="Canvas" className="flex flex-wrap items-center gap-3 text-small text-muted">
        <Link
          href={backHref}
          className="inline-flex min-h-9 items-center rounded-full border border-border bg-bg px-4 font-semibold text-text hover:bg-soft"
          data-testid="canvas-focus-back"
        >
          ← Back to canvas
        </Link>
        <span className="truncate">{canvasName}</span>
      </nav>
      {children}
    </div>
  );
}
