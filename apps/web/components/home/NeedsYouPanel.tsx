import type { Route } from "next";
import Link from "next/link";
import { JOURNEY_STEPS } from "@/lib/home/journey";
import type { NeedsYou, NeedsYouKind } from "@/lib/home/needs-you";

/** The colour of each kind's dot: votes amber, empty fields cobalt, a reply green. */
const DOT: Readonly<Record<NeedsYouKind, string>> = {
  "quote-sent": "pulse-dot bg-ok",
  vote: "pulse-dot bg-warn",
  confirm: "pulse-dot bg-cobalt-soft",
  share: "pulse-dot bg-ink-2",
  "quote-waiting": "inline-block size-2.5 flex-none rounded-full bg-faint",
};

const HEADING = "font-mono text-xs uppercase tracking-[0.1em] text-muted";

/** What is waiting on the person: each thing a row that opens where it is dealt with. */
export function NeedsYouPanel({ needs }: Readonly<{ needs: NeedsYou }>) {
  return (
    <section aria-labelledby="needs-you" className="glass flex h-full flex-col gap-2.5 rounded-[2rem] p-5 sm:rounded-[2.5rem] sm:p-7">
      <h2 id="needs-you" className={HEADING}>
        Needs you
      </h2>
      {needs.items.length === 0 ? (
        <p className="py-2 text-[15px] leading-relaxed text-ink-2">
          Nothing is waiting on you. Votes, quotes and factory files with empty fields show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="needs-you">
          {needs.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className="lift flex items-center gap-3.5 rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3.5 text-ink no-underline"
              >
                <span className="fill-layer" aria-hidden="true" />
                <span className={DOT[item.kind]} aria-hidden="true" />
                <span className="flex-1 text-[15px] leading-snug">{item.text}</span>
                <span className="text-[13px] text-[#dfe4ff]">{item.action}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {needs.more > 0 ? (
        <p className="text-[13px] text-muted">
          {needs.more === 1 ? "1 more thing is" : `${needs.more} more things are`} waiting in your designs.
        </p>
      ) : null}
    </section>
  );
}

const STEP_TEXT: Readonly<Record<(typeof JOURNEY_STEPS)[number]["id"], string>> = {
  design: "Draw the garment and choose its colours, in your own words or step by step.",
  "factory-file": "Fill the empty fields, then download the file a factory works from.",
  committee: "Send a link. Your committee votes yes or not yet, with no account.",
  quote: "Ask for a price. We reply by email.",
};

/** For a brand with no designs yet: the four steps every design goes through. */
export function JourneyPanel() {
  return (
    <section aria-labelledby="how-it-goes" className="glass flex h-full flex-col gap-3 rounded-[2rem] p-5 sm:rounded-[2.5rem] sm:p-7">
      <h2 id="how-it-goes" className={HEADING}>
        How a design gets made
      </h2>
      <ol className="flex flex-col gap-2.5">
        {JOURNEY_STEPS.map((step, index) => (
          <li key={step.id} className="flex gap-3.5 rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3.5">
            <span className="grid size-7 flex-none place-items-center rounded-full bg-white/10 font-mono text-xs text-ink">
              {index + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium text-ink">{step.label}</span>
              <span className="text-[13.5px] leading-relaxed text-ink-2">{STEP_TEXT[step.id]}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
