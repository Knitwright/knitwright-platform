"use client";

import { useId, useState } from "react";
import { Notice } from "@/components/ui/Notice";
import {
  ARTBOARD_UNITS,
  aspectOf,
  DEFAULT_DPI,
  matchingPreset,
  presetSize,
  printSize,
  readSize,
  UNIT_LABELS,
  UNIT_SUFFIX,
  writeLength,
  type ArtboardPreset,
  type ArtboardUnit,
  type BoardView,
  type Size,
} from "@/lib/launch";

type Props = Readonly<{
  board: BoardView;
  unit: ArtboardUnit;
  presets: readonly ArtboardPreset[];
  busy: boolean;
  onUnit: (unit: ArtboardUnit) => void;
  onSize: (size: Size) => void;
}>;

const FIELD = "min-h-10 w-full rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink";
const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3 text-[13px] text-ink";

/**
 * Artboard size, in the right inspector with a board selected (spec Launch shell): the unit, the
 * width and height, the presets and the live print size.
 *
 * The unit is a way of reading a size, never a change to it: switching from pixels to millimetres
 * rewrites the fields and leaves the artboard alone, as the editor's centimetre and inch toggle
 * does for a design. A size outside what the canvas can draw is refused with the bound in the
 * message, rather than quietly turned into a different number.
 *
 * Every preset is a row of `launch_artboard_presets`, and the note that comes with it is shown, so
 * nobody takes a seeded size for one a person agreed to.
 */
export function ArtboardSize({ board, unit, presets, busy, onUnit, onSize }: Props) {
  const ids = { unit: useId(), width: useId(), height: useId() };
  const [typed, setTyped] = useState<{ width: string; height: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dpi = presets.find((preset) => preset.unit === unit)?.dpi ?? DEFAULT_DPI;
  const shown = typed ?? { width: writeLength(board.size.width, unit, dpi), height: writeLength(board.size.height, unit, dpi) };
  const current = matchingPreset(board.size, presets);

  const apply = () => {
    const verdict = readSize(Number(shown.width), Number(shown.height), unit, dpi);
    if (!verdict.ok) return setProblem(verdict.reason);
    setProblem(null);
    setTyped(null);
    onSize(verdict.size);
  };

  return (
    <section aria-label="Artboard size" className="flex flex-col gap-3" data-testid="artboard-size">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.unit} className="text-[13px] font-medium text-ink">
          Unit
        </label>
        <select
          id={ids.unit}
          className={FIELD}
          value={unit}
          disabled={busy}
          onChange={(event) => {
            setTyped(null);
            setProblem(null);
            onUnit(event.target.value as ArtboardUnit);
          }}
        >
          {ARTBOARD_UNITS.map((one) => (
            <option key={one} value={one}>
              {UNIT_LABELS[one]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field id={ids.width} label={`Width (${UNIT_SUFFIX[unit]})`} value={shown.width} busy={busy} onChange={(width) => setTyped({ ...shown, width })} onDone={apply} />
        <Field id={ids.height} label={`Height (${UNIT_SUFFIX[unit]})`} value={shown.height} busy={busy} onChange={(height) => setTyped({ ...shown, height })} onDone={apply} />
      </div>

      <p className="font-mono text-[11px] tracking-wider text-chalk-muted uppercase" data-testid="artboard-print-size">
        {printSize(board.size, unit, dpi)} · {aspectOf(board.size)}
      </p>

      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-medium text-ink">Presets</h3>
        {presets.length === 0 ? (
          <p className="text-[13px] text-chalk-muted">No artboard size is on file yet. Type a width and a height instead.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <li key={preset.key}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={current?.key === preset.key}
                  title={preset.note}
                  onClick={() => {
                    setTyped(null);
                    setProblem(null);
                    onSize(presetSize(preset));
                  }}
                  className={`${CHIP} ${current?.key === preset.key ? "bg-cobalt text-white" : ""}`}
                >
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {presets.length > 0 ? (
          <p className="text-[12px] leading-relaxed text-chalk-muted">
            {current ? current.note : "Every preset carries a note saying where its size came from. Hover one to read it."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

type FieldProps = Readonly<{ id: string; label: string; value: string; busy: boolean; onChange: (value: string) => void; onDone: () => void }>;

function Field({ id, label, value, busy, onChange, onDone }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className={FIELD}
        value={value}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onDone}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onDone();
        }}
      />
    </div>
  );
}
