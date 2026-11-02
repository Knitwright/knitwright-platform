"use client";

import { useEffect, useState } from "react";
import { BUSY_LABEL, STEPS } from "@/lib/crest-to-kit/words";

/**
 * Honest progress while the kits are built (the owner's bar: "not a frozen panel").
 *
 * It does not pretend to know how far along the work is — nothing reports that — so it says what is
 * being done, step by step, and ticks each one off as the next begins. It is a live region, so a
 * screen reader is told as it moves.
 *
 * The caller renders it only while the work is in flight, so it starts at the first step every
 * time: a component that is unmounted needs nothing resetting.
 */

/** How long each step is shown for before the next is named. Knitwright's own pacing, not a measurement. */
export const STEP_MS = 900;

export function Progress() {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setAt((step) => Math.min(step + 1, STEPS.length - 1)), STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="crest-to-kit-progress"
      className="flex flex-col gap-2 rounded-2xl border border-cobalt-soft/30 bg-cobalt-wash p-4"
    >
      <p className="text-sm font-medium text-ink">{BUSY_LABEL}</p>
      <ol className="flex flex-col gap-1">
        {STEPS.map((step, index) => (
          <li key={step} className={`text-[13px] ${index <= at ? "text-ink-2" : "text-faint"}`}>
            <span aria-hidden="true" className="mr-2">
              {index < at ? "✓" : index === at ? "…" : "·"}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
