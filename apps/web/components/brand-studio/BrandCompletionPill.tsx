import Link from "next/link";
import { Suspense } from "react";
import { completionOf } from "@/lib/brand-studio/completion";
import { loadRecord } from "@/lib/brand-studio/service";
import { activeBrand, sessionClient } from "@/lib/server/deps";

/**
 * The completion pill of F-S9's brand switcher: "a brand switcher in the top bar with a completion
 * % pill". It sits beside the brand name the header already shows and links to Brand Studio.
 *
 * It reads the brand itself rather than taking props, so the header needs no new wiring, and it is
 * wrapped in its own Suspense boundary so the rest of the page shell never waits for it. The read
 * goes through the member's own client, so row level security answers for it.
 */
async function Pill() {
  const brand = await activeBrand();
  if (!brand) return null;
  const { percent } = completionOf(await loadRecord(await sessionClient(), brand));
  return (
    <Link
      href="/brand-studio"
      // Three characters wide and never shrinks, so the header's own truncating items absorb the
      // width it takes and no label can be pushed over another (a seventh section pill once did).
      className="nav-pill hidden shrink-0 items-center rounded-full border border-white/12 px-3 py-2.5 text-sm text-ink sm:inline-flex"
    >
      <span className="sr-only">Brand Studio. Your brand is {percent} per cent complete.</span>
      <span aria-hidden="true" data-testid="brand-completion-pill">
        {percent}%
      </span>
    </Link>
  );
}

/** The pill, or nothing at all while it is read or if it cannot be. */
export function BrandCompletionPill() {
  return (
    <Suspense fallback={null}>
      <Pill />
    </Suspense>
  );
}
