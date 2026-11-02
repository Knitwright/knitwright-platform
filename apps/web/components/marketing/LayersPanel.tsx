"use client";

import { useId, useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import { asSettings, layerRows, selectedMarketing, setHidden, setLocked, setOpacity, type LayerRow, type MarketingBoardSettings } from "@/lib/marketing";
import { PANEL_CHIP, PanelFrame } from "./PanelFrame";

/**
 * THE LAYERS PANEL (spec Launch shell: "Layers -- what is on the selected artboard, in order, with
 * opacity and locking"; plan v5 L4, decision 0094).
 *
 * The stack, top first. Each row can be hidden, locked and faded. A mockup's lock is the garment's,
 * not the person's: the row says so and the control is not offered, because a control that refuses
 * every press is worse than no control at all.
 */
export default function LayersPanel({ context, commands }: LaunchPanelProps) {
  const selected = selectedMarketing(context);
  const [problem, setProblem] = useState<string | null>(null);
  const rows = selected ? layerRows(selected.slots, selected.settings) : [];

  const save = (settings: MarketingBoardSettings): void => {
    if (!selected) return;
    setProblem(null);
    commands.setBoardSettings(selected.board.id, asSettings(settings));
  };

  const change = (verdict: ReturnType<typeof setHidden>): void => {
    if (!verdict.ok) return setProblem(verdict.reason);
    save(verdict.settings);
  };

  return (
    <PanelFrame id="layers" ready={rows.length > 0} busy={context.busy} problem={problem} onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}>
      <ul className="flex flex-col gap-2" data-testid="marketing-layers">
        {rows.map((row) => (
          <li key={row.slot.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/10 bg-tile-2/60 p-3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-[13px] text-ink">{row.slot.label}</span>
              <span className="font-mono text-[11px] text-ink-2">{row.depth}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-ink-2">{row.note}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={context.busy}
                aria-pressed={row.hidden}
                className={PANEL_CHIP}
                onClick={() => selected && change(setHidden(selected.settings, row.slot, !row.hidden))}
              >
                {row.hidden ? "Show" : "Hide"}
                <span className="sr-only"> {row.slot.label}</span>
              </button>
              {row.lockedByTheGarment ? (
                <span className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 text-[12px] text-ink-2">Locked by the garment</span>
              ) : (
                <button
                  type="button"
                  disabled={context.busy}
                  aria-pressed={row.locked}
                  className={PANEL_CHIP}
                  onClick={() => selected && change(setLocked(selected.settings, row.slot, !row.locked))}
                >
                  {row.locked ? "Unlock" : "Lock"}
                  <span className="sr-only"> {row.slot.label}</span>
                </button>
              )}
            </div>
            <Opacity row={row} busy={context.busy} onSet={(value) => selected && change(setOpacity(selected.settings, row.slot, value))} />
          </li>
        ))}
      </ul>
    </PanelFrame>
  );
}

type OpacityProps = Readonly<{ row: LayerRow; busy: boolean; onSet: (value: number) => void }>;

function Opacity({ row, busy, onSet }: OpacityProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="text-[12px] text-ink-2">
        Opacity
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={row.opacity}
        disabled={busy}
        className="min-w-0 flex-1 accent-cobalt-soft"
        onChange={(event) => onSet(Number(event.target.value))}
      />
      <output htmlFor={id} className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-2">
        {row.opacity}%
      </output>
    </div>
  );
}
