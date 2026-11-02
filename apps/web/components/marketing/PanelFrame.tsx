import type { ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import { PANEL_WORDS, type MarketingPanelId } from "@/lib/marketing";

/**
 * The frame every marketing panel sits in (plan v5 L4, decision 0094).
 *
 * One heading, one line about what the panel is for, and -- when there is nothing in it -- a real
 * empty state that names the one action that fills it. The words are `PANEL_WORDS`, so a test reads
 * them rather than guessing at markup, and nothing is written twice.
 *
 * Secondary text is `text-ink-2`. L1 found `text-chalk-muted` on `glass` fails the AA contrast
 * check, and the whole launch chrome follows `text-ink-2` because of it.
 */

export const PANEL_FIELD =
  "min-h-10 w-full min-w-0 rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

export const PANEL_CHIP =
  "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

type Props = Readonly<{
  id: MarketingPanelId;
  /** False when the panel has nothing to show, which draws the empty state instead of the children. */
  ready: boolean;
  /** What the empty state's one action does, or null when the panel cannot offer it here. */
  onAction?: (() => void) | null;
  busy?: boolean;
  /** Something that went wrong, in words that say what to do. */
  problem?: string | null;
  children: ReactNode;
}>;

export function PanelFrame({ id, ready, onAction = null, busy = false, problem = null, children }: Props) {
  const words = PANEL_WORDS[id];
  return (
    <section aria-label={words.title} data-testid={`marketing-panel-${id}`} className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 className="text-[13px] font-medium text-ink">{words.title}</h3>
        <p className="text-[12px] leading-relaxed text-ink-2">{words.lead}</p>
      </header>

      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}

      {ready ? (
        children
      ) : (
        <div data-testid={`marketing-empty-${id}`} className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/20 bg-tile-2/90 p-4">
          <p className="text-[13px] leading-relaxed text-ink-2">{words.empty}</p>
          {onAction ? (
            <button type="button" disabled={busy} onClick={onAction} className={PANEL_CHIP} data-testid={`marketing-action-${id}`}>
              {words.action}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
