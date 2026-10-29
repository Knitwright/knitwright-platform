import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { chipHref, emptyFor, JUMP_CHIP_VIEWS, showsDesigns, type JumpChip } from "@/lib/home/jump-back-in";

/**
 * "Jump back in" (spec F-S4): the filter chips and the cards under them. Designs are the only kind
 * the platform stores, so a chip for another kind says it is coming in a later release instead of
 * showing an empty row.
 */
export function JumpBackIn({ chip, children }: Readonly<{ chip: JumpChip; children: ReactNode }>) {
  const chosen = JUMP_CHIP_VIEWS.find((view) => view.id === chip);
  const empty = chosen ? emptyFor(chosen) : null;

  return (
    <section aria-labelledby="jump-back-in" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="jump-back-in" className="text-xl font-medium tracking-[-0.02em] text-ink">
          Jump back in
        </h2>
        <ul aria-label="Kinds of project" className="flex flex-wrap items-center gap-1.5">
          {JUMP_CHIP_VIEWS.map((view) => (
            <li key={view.id}>
              <Link
                href={chipHref("/studio", view.id) as Route}
                aria-current={view.id === chip ? "true" : undefined}
                className={`nav-pill inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] no-underline ${
                  view.id === chip ? "border-white/25 bg-white/12 text-white" : "border-white/12 text-muted"
                }`}
              >
                {view.label}
                {view.built ? null : <span className="sr-only"> (coming in a later release)</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {empty ? <p className="glass rounded-[1.5rem] p-5 text-[15px] text-ink-2">{empty}</p> : null}
      {showsDesigns(chip) ? children : null}
    </section>
  );
}

/** The coloured type tag a card carries (spec F-S4: "Cards carry coloured type tags"). */
export function TypeTag({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex items-center rounded-full bg-cobalt-wash px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-cobalt-soft">
      {label}
    </span>
  );
}
