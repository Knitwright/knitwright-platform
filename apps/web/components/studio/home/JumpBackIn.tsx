import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { chipHref, emptyFor, JUMP_CHIP_VIEWS, showsDesigns, type JumpChip } from "@/lib/home/jump-back-in";

/**
 * "Jump back in" (spec F-S4; d02 on Recent): the filter chips and the cards under them. Designs are
 * the only kind the platform stores, so a chip for another kind says it is coming in a later release
 * instead of showing an empty row. `path` is the page it sits on, which the chips link back to.
 */
export function JumpBackIn({ chip, path, children }: Readonly<{ chip: JumpChip; path: string; children: ReactNode }>) {
  const chosen = JUMP_CHIP_VIEWS.find((view) => view.id === chip);
  const empty = chosen ? emptyFor(chosen) : null;

  return (
    <section aria-labelledby="jump-back-in" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 id="jump-back-in" className="text-h1 text-text">
          Jump back in
        </h2>
        <ul aria-label="Kinds of project" className="flex flex-wrap items-center gap-2">
          {JUMP_CHIP_VIEWS.map((view) => (
            <li key={view.id}>
              <Link
                href={chipHref(path, view.id) as Route}
                aria-current={view.id === chip ? "true" : undefined}
                className={cx(
                  "inline-flex h-9 items-center rounded-full border px-4 text-body font-medium no-underline transition-colors duration-fast",
                  view.id === chip ? "border-navy bg-navy text-on-dark" : "border-border bg-bg text-text-2 hover:bg-soft",
                )}
              >
                {view.label}
                {view.built ? null : <span className="sr-only"> (coming in a later release)</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {empty ? <p className="rounded-xl bg-soft p-5 text-body text-text-2">{empty}</p> : null}
      {showsDesigns(chip) ? children : null}
    </section>
  );
}

/** The type tag a card carries (spec F-S4: "Cards carry coloured type tags"; d02's DESIGN). */
export function TypeTag({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex h-5 items-center self-start rounded-xs bg-gold-soft px-1.5 text-micro uppercase text-navy">
      {label}
    </span>
  );
}
