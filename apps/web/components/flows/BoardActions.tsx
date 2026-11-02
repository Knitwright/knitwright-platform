"use client";

import { useState } from "react";
import { DEFAULT_UPSCALE, operationsFor, planOperation, UPSCALE_FACTORS, type FlowCostSource, type OperationId } from "@/lib/flows";
import { aspectOf, presetSize, type ArtboardPreset, type BoardView, type Graph } from "@/lib/launch";

/**
 * Flatten, Upscale and Reframe: the three items the spec puts behind "more" on a board's task bar
 * (Launch shell, F-L4).
 *
 * Each one says what it will do and what it will cost **before** it is pressed, and one that cannot
 * be used stays on screen with the reason beside it rather than disappearing. Each is a change to
 * the board's own settings followed by a rerun, so each goes through the garment lock, the estimate
 * and the refund like any other run.
 */

export type BoardActionsProps = Readonly<{
  graph: Graph;
  board: BoardView;
  source: FlowCostSource;
  presets: readonly ArtboardPreset[];
  busy: boolean;
  onOperation: (id: OperationId, options: Readonly<{ factor?: number; presetKey?: string }>) => void;
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[12px] text-ink";

export function BoardActions({ graph, board, source, presets, busy, onOperation }: BoardActionsProps) {
  const [factor, setFactor] = useState<number>(DEFAULT_UPSCALE);
  const [chosen, setChosen] = useState<string | null>(null);
  /**
   * Derived, not initialised: the artboard rows arrive from the server, so a state set once from
   * `presets[0]` would stay empty on the first paint and then disagree with the `<select>` the
   * person is looking at. Reframe would be refused for a shape the screen shows as picked.
   */
  const presetKey = chosen ?? presets[0]?.key ?? "";
  const options = { factor, ...(presetKey === "" ? {} : { presetKey }) };
  const offers = operationsFor({ graph, board, source, presets, ...options });

  /** Only what the operation needs: a key the schema would refuse must not ride along with Flatten. */
  const optionsFor = (id: OperationId): Readonly<{ factor?: number; presetKey?: string }> =>
    id === "upscale" ? { factor } : id === "reframe" && presetKey !== "" ? { presetKey } : {};

  return (
    <section aria-label="This board" data-testid="flow-board-actions" className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium text-ink">This board</h3>

      <ul className="flex flex-col gap-2">
        {offers.map((offer) => {
          const plan = planOperation(offer.id, { graph, board, source, presets, ...options });
          return (
            <li key={offer.id} className="flex flex-col gap-1 border-b border-white/10 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || offer.blocked !== null}
                  aria-describedby={`flow-op-why-${offer.id}`}
                  onClick={() => onOperation(offer.id, optionsFor(offer.id))}
                  className={CHIP}
                  data-testid={`flow-op-${offer.id}`}
                >
                  {offer.label}
                </button>
                <span className="font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">
                  {offer.credits === 0 ? "free" : `${offer.credits} ${offer.credits === 1 ? "credit" : "credits"}`}
                </span>
              </div>
              <p id={`flow-op-why-${offer.id}`} className="text-[11px] leading-relaxed text-ink-2">
                {offer.blocked ?? plan?.note ?? offer.lead}
              </p>

              {offer.id === "upscale" ? (
                <fieldset className="flex flex-wrap items-center gap-1.5">
                  <legend className="sr-only">How much bigger</legend>
                  {UPSCALE_FACTORS.map((one) => (
                    <button
                      key={one}
                      type="button"
                      aria-pressed={one === factor}
                      disabled={busy}
                      onClick={() => setFactor(one)}
                      className={`${CHIP} ${one === factor ? "border-cobalt" : ""}`}
                      data-testid={`flow-upscale-${one}`}
                    >
                      {one}×
                    </button>
                  ))}
                </fieldset>
              ) : null}

              {offer.id === "reframe" && presets.length > 0 ? (
                <label className="flex flex-col gap-1 text-[11px] text-ink-2">
                  <span>Shape</span>
                  <select
                    value={presetKey}
                    disabled={busy}
                    onChange={(event) => setChosen(event.target.value)}
                    className="min-h-10 rounded-xl border border-white/20 bg-surface-solid px-2 text-[12px] text-ink"
                    data-testid="flow-reframe-preset"
                  >
                    {presets.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label} ({aspectOf(presetSize(preset))})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
