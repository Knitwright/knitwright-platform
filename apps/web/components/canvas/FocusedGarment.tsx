import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { TopBarSlot } from "@/components/shell/TopBarSlot";

/**
 * Focused mode (decision 0145): a Garment board opened for editing, in place on its canvas. The
 * canvas's address stays; `?focus=` says which board is open, and "Back to canvas" takes it off.
 * Until E3 rebuilds the garment inspector this is the existing editor, whole, so every studio panel
 * keeps its door.
 *
 * From `md` up the way back sits in the top bar's centre, so the editor keeps the whole screen below
 * it (its own rule: only its panels scroll). A phone's bar has no centre, so there it sits above the
 * editor, which scrolls on a phone anyway.
 */

const BACK = "inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-bg px-4 font-semibold text-text hover:bg-soft";

function Back({ href, name, testId }: Readonly<{ href: Route; name: string; testId: string }>) {
  return (
    <span className="flex min-w-0 items-center gap-3 text-small text-muted">
      <Link href={href} className={BACK} data-testid={testId}>
        ← Back to canvas
      </Link>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function FocusedGarment({ backHref, canvasName, children }: Readonly<{ backHref: Route; canvasName: string; children: ReactNode }>) {
  return (
    <>
      <TopBarSlot>
        <nav aria-label="Canvas" className="hidden md:flex" data-testid="canvas-focus">
          <Back href={backHref} name={canvasName} testId="canvas-focus-back" />
        </nav>
      </TopBarSlot>
      <nav aria-label="Canvas, on a phone" className="mb-3 flex md:hidden">
        <Back href={backHref} name={canvasName} testId="canvas-focus-back-phone" />
      </nav>
      {children}
    </>
  );
}
