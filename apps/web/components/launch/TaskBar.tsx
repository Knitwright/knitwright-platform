"use client";

import { useState } from "react";
import type { BoardKind, TaskAction, TaskBar as TaskBarView } from "@/lib/launch";

type Props = Readonly<{
  bar: TaskBarView;
  busy: boolean;
  onAdd: (kind: BoardKind) => void;
  onAction: (action: TaskAction) => void;
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[13px] text-ink disabled:cursor-not-allowed disabled:opacity-55";

/**
 * The contextual task bar over the selection (spec Launch shell). Everything it offers comes from
 * `lib/launch/task-bar.ts`, including which items are off and why: Remove background and Remix are
 * off on a picture the platform drew, because they would change the garment (spec decision 13), and
 * the handing-over items are off until a board has actually run.
 *
 * An item that is off keeps its place and says why in its title, rather than disappearing: a
 * control that comes and goes is harder to learn than one that explains itself.
 */
export function TaskBar({ bar, busy, onAdd, onAction }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const front = bar.items.filter((item) => !item.inMore);
  const more = bar.items.filter((item) => item.inMore);

  return (
    <div role="toolbar" aria-label={`Actions for the ${bar.title}`} data-testid="launch-task-bar" className="glass flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
      <p className="font-mono text-[11px] tracking-[0.08em] text-chalk-muted uppercase">{bar.title}</p>
      {bar.add.map((entry) => (
        <button key={entry.kind} type="button" disabled={busy} onClick={() => onAdd(entry.kind)} className={CHIP} data-testid={`task-add-${entry.kind}`}>
          {entry.label}
          <span className="ml-1.5 font-mono text-[11px] text-chalk-muted">{entry.paid ? "credits" : "free"}</span>
        </button>
      ))}
      {front.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={busy || item.disabledReason !== null}
          title={item.disabledReason ?? undefined}
          onClick={() => onAction(item.id)}
          className={CHIP}
          data-testid={`task-${item.id}`}
        >
          {item.label}
        </button>
      ))}
      {more.length === 0 ? null : (
        <div className="relative">
          <button type="button" aria-expanded={moreOpen} aria-controls="task-more" onClick={() => setMoreOpen(!moreOpen)} className={CHIP} data-testid="task-more">
            More
          </button>
          {moreOpen ? (
            <ul id="task-more" aria-label="More actions" className="glass absolute right-0 z-30 mt-2 flex w-48 flex-col rounded-2xl p-2 shadow-lg">
              {more.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy || item.disabledReason !== null}
                    title={item.disabledReason ?? undefined}
                    onClick={() => {
                      setMoreOpen(false);
                      onAction(item.id);
                    }}
                    className="flex min-h-10 w-full items-center rounded-xl px-3 text-left text-[13px] text-ink hover:bg-tile-2 disabled:cursor-not-allowed disabled:opacity-55"
                    data-testid={`task-${item.id}`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
