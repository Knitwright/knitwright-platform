import Link from "next/link";
import type { ReactNode } from "react";
import { alertProps, busyProps, panelProps } from "@/components/mockups/a11y";
import { EMPTY_ACTIONS, EMPTY_BODIES, EMPTY_TITLES, FAILED, LOADING, PANEL_LEADS, PANEL_TITLES, RETRY, type BuiltHere } from "@/lib/launch-panels";

/**
 * The frame the three built rail panels sit in (plan v5, decision 0106).
 *
 * One heading, one line about what the panel is for, and the three states the owner's bar asks
 * for: reading it, unable to read it with what to do about it, and a real empty state naming the
 * one action that fills it. The words are `lib/launch-panels/words.ts`, so a test reads them rather
 * than guessing at markup.
 *
 * Two contrast facts of this chrome, both measured, are built in rather than left to each panel:
 * secondary text is `text-ink-2`, because `text-chalk-muted` on `glass` fails AA; and an inline
 * link is `text-ink` and underlined, because `text-cobalt-soft` is 3.92:1 over the aurora and its
 * own `opacity: 0.9` is what pushes it under.
 */

/** A chip-shaped button, at the 40 px target the rest of the launch chrome uses. */
export const CHIP =
  "chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-3.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

/** A smaller chip for a filter row. Still above the 24 px minimum target. */
export const SMALL_CHIP =
  "chip-btn inline-flex min-h-9 items-center rounded-full border px-3 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft";

export const FIELD =
  "min-h-10 w-full min-w-0 rounded-xl border border-white/15 bg-surface px-2.5 text-[13px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

/** An inline link in this chrome: `text-ink` and underlined, never the dimmed cobalt. */
export const INLINE_LINK = "font-medium text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft";

export const CARD = "flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/12 bg-tile-2/90 p-3";

type ShellProps = Readonly<{
  id: BuiltHere;
  headingId: string;
  busy: boolean;
  children: ReactNode;
}>;

/** The panel itself: a labelled region with its heading and its one line of lead. */
export function PanelShell({ id, headingId, busy, children }: ShellProps) {
  return (
    <section {...panelProps(headingId, busy)} className="flex min-h-0 min-w-0 flex-col gap-3" data-testid={`launch-${id}-panel`}>
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-[15px] font-medium text-ink">
          {PANEL_TITLES[id]}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{PANEL_LEADS[id]}</p>
      </header>
      {children}
    </section>
  );
}

/** Said while a read is in flight, and told to a screen reader without taking the focus. */
export function PanelLoading({ id }: Readonly<{ id: BuiltHere }>) {
  return (
    <p {...busyProps()} data-testid={`launch-${id}-loading`} className="text-[13px] leading-relaxed text-ink-2">
      {LOADING[id]}
    </p>
  );
}

/** Said when a read failed: what happened, that nothing changed, and the one thing to try. */
export function PanelProblem({ id, onRetry }: Readonly<{ id: BuiltHere; onRetry: () => void }>) {
  return (
    <div {...alertProps()} data-testid={`launch-${id}-failed`} className="flex flex-col items-start gap-2 rounded-2xl border border-warn/30 bg-warn-wash p-3">
      <p className="text-[13px] leading-relaxed text-warn">{FAILED[id]}</p>
      <button type="button" onClick={onRetry} className={CHIP} data-testid={`launch-${id}-retry`}>
        {RETRY}
      </button>
    </div>
  );
}

/** The real empty state: what is not there, and the one action that fills it. */
export function PanelEmpty({ id }: Readonly<{ id: BuiltHere }>) {
  const action = EMPTY_ACTIONS[id];
  return (
    <div data-testid={`launch-${id}-empty`} className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-white/20 bg-tile-2/90 p-4">
      <h3 className="text-[14px] font-medium text-ink">{EMPTY_TITLES[id]}</h3>
      <p className="text-[13px] leading-relaxed text-ink-2">{EMPTY_BODIES[id]}</p>
      <Link href={action.href} className={CHIP} data-testid={`launch-${id}-action`}>
        {action.label}
      </Link>
    </div>
  );
}

/** A note that explains itself: the sentence, and the rule it rests on. */
export function PanelGap({ note, testId }: Readonly<{ note: Readonly<{ ruleId: string; line: string }>; testId: string }>) {
  return (
    <p data-testid={testId} className="text-[12px] leading-relaxed text-ink-2">
      {note.line} <span className="font-mono">{note.ruleId}</span>
    </p>
  );
}
