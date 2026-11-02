"use client";

import { useId, useState } from "react";
import { ARTBOARD_UNITS, UNIT_LABELS, UNIT_SUFFIX, writeLength, type ArtboardUnit, type BoardView } from "@/lib/launch";
import { Notice } from "@/components/ui/Notice";
import {
  COLOUR_SPACES,
  COLOUR_SPACE_LABELS,
  FORMAT_LABELS,
  colourNote,
  dpiOffered,
  exportVerdict,
  formatsOffered,
  fullTargets,
  quickTargets,
  quickVerdict,
  ruleForPlan,
  type ColourSpace,
  type ExportBoard,
  type FileFormat,
} from "@/lib/marketing";
import { PANEL_CHIP, PANEL_FIELD } from "./PanelFrame";
import { NOT_WIRED, useMarketingServices } from "./services";

/**
 * THE EXPORT PANEL (spec F-L2 "Export"; plan v5 L4, decision 0094).
 *
 * Quick export at 1x, 2x and 3x; then the full export: the artboards chosen, the width and height
 * in pixels, inches or millimetres, the resolution, the **live print size**, the format, the colour
 * space, Remove background, and a zip when there is more than one artboard.
 *
 * Every choice goes through `exportVerdict`, so the panel shows either what it will produce or a
 * sentence saying what cannot be done and what to do instead. It never offers a button that would
 * make the wrong file.
 */

type Props = Readonly<{
  board: BoardView;
  /** The other marketing boards, for the spec's "Selected artboards (n)" checklist. */
  others: readonly BoardView[];
  busy: boolean;
  unit: ArtboardUnit;
}>;

const asExportBoard = (board: BoardView): ExportBoard => ({ id: board.id, name: board.name, size: board.size });

export function ExportPanel({ board, others, busy, unit: projectUnit }: Props) {
  const { targets, watermarkRules, plan, cmykProfile, onExport } = useMarketingServices();
  const ids = { unit: useId(), width: useId(), height: useId(), dpi: useId(), format: useId(), space: useId() };
  const rule = ruleForPlan(watermarkRules, plan);
  const full = fullTargets(targets);

  const [chosen, setChosen] = useState<readonly string[]>([board.id]);
  const [unit, setUnit] = useState<ArtboardUnit>(projectUnit);
  const [dpi, setDpi] = useState<number>(dpiOffered(targets)[0] ?? 72);
  const [format, setFormat] = useState<FileFormat>("png");
  const [space, setSpace] = useState<ColourSpace>("rgb");
  const [removeBackground, setRemoveBackground] = useState(false);
  const [size, setSize] = useState<{ width: string; height: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const boards = [board, ...others].filter((one) => chosen.includes(one.id));
  const shown = size ?? { width: writeLength(board.size.width, unit, dpi), height: writeLength(board.size.height, unit, dpi) };
  const verdict = exportVerdict({
    boards: boards.map(asExportBoard),
    width: Number(shown.width),
    height: Number(shown.height),
    unit,
    dpi,
    format,
    colourSpace: space,
    removeBackground,
    rule,
    cmykProfile: cmykProfile !== null,
  });

  const send = (targetKey: string): void => {
    if (onExport === null) return setNote(NOT_WIRED);
    setNote(null);
    onExport({ boardIds: boards.map((one) => one.id), targetKey });
  };

  return (
    <section aria-label="Export" data-testid="marketing-export" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[13px] font-medium text-ink">Export</h3>

      <section aria-label="Quick export" className="flex flex-col gap-2">
        <h4 className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">Quick</h4>
        <ul className="flex flex-wrap gap-2">
          {quickTargets(targets).map((target) => {
            const quick = quickVerdict(target, asExportBoard(board), rule);
            return (
              <li key={target.key}>
                <button
                  type="button"
                  disabled={busy || !quick.ok}
                  title={quick.ok ? `${quick.plan.size.width} × ${quick.plan.size.height} px` : quick.reason}
                  onClick={() => send(target.key)}
                  className={PANEL_CHIP}
                  data-testid={`marketing-quick-${target.key}`}
                >
                  {target.label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Selected artboards" className="flex flex-col gap-2">
        <h4 className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">Selected artboards ({boards.length})</h4>
        <ul className="flex flex-col gap-1.5">
          {[board, ...others].map((one) => (
            <li key={one.id} className="flex items-center gap-2">
              <input
                id={`${ids.unit}-${one.id}`}
                type="checkbox"
                className="size-4 accent-cobalt-soft"
                checked={chosen.includes(one.id)}
                disabled={busy}
                onChange={(event) => setChosen(event.target.checked ? [...chosen, one.id] : chosen.filter((id) => id !== one.id))}
              />
              <label htmlFor={`${ids.unit}-${one.id}`} className="min-w-0 truncate text-[13px] text-ink">
                {one.name || "Artboard"}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Choice id={ids.unit} label="Unit" value={unit} onChange={(value) => { setSize(null); setUnit(value as ArtboardUnit); }} busy={busy}>
          {ARTBOARD_UNITS.map((one) => (
            <option key={one} value={one}>
              {UNIT_LABELS[one]}
            </option>
          ))}
        </Choice>
        <Choice id={ids.dpi} label="Resolution (DPI)" value={String(dpi)} onChange={(value) => { setSize(null); setDpi(Number(value)); }} busy={busy}>
          {dpiOffered(targets).map((one) => (
            <option key={one} value={one}>
              {one === 72 ? "72 · screen" : `${one} · print`}
            </option>
          ))}
        </Choice>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SizeField id={ids.width} label={`Width (${UNIT_SUFFIX[unit]})`} value={shown.width} busy={busy} onChange={(width) => setSize({ ...shown, width })} />
        <SizeField id={ids.height} label={`Height (${UNIT_SUFFIX[unit]})`} value={shown.height} busy={busy} onChange={(height) => setSize({ ...shown, height })} />
      </div>

      <p className="font-mono text-[11px] tracking-wider text-ink-2 uppercase" data-testid="marketing-print-size">
        {verdict.ok ? `${verdict.plan.printSize} · ${verdict.plan.size.width} × ${verdict.plan.size.height} px` : "Print size: not until the size is one we can make"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Choice id={ids.format} label="Format" value={format} onChange={(value) => setFormat(value as FileFormat)} busy={busy}>
          {formatsOffered(targets).map((one) => (
            <option key={one} value={one}>
              {FORMAT_LABELS[one]}
            </option>
          ))}
        </Choice>
        <Choice id={ids.space} label="Colour" value={space} onChange={(value) => setSpace(value as ColourSpace)} busy={busy}>
          {COLOUR_SPACES.map((one) => (
            <option key={one} value={one}>
              {COLOUR_SPACE_LABELS[one]}
            </option>
          ))}
        </Choice>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-2">{colourNote(space, cmykProfile)}</p>

      <div className="flex items-center gap-2">
        <input id={`${ids.space}-bg`} type="checkbox" className="size-4 accent-cobalt-soft" checked={removeBackground} disabled={busy} onChange={(event) => setRemoveBackground(event.target.checked)} />
        <label htmlFor={`${ids.space}-bg`} className="text-[13px] text-ink">
          Remove background
        </label>
      </div>

      {verdict.ok ? (
        <>
          <p className="text-[12px] leading-relaxed text-ink-2" data-testid="marketing-export-note">
            {verdict.plan.zip ? `${verdict.plan.fileNames.length} files as a zip, a folder per format.` : verdict.plan.fileNames[0]}
            {verdict.plan.watermark ? ` ${rule?.label} exports carry the Knitwright preview mark.` : ""}
          </p>
          <button type="button" disabled={busy} onClick={() => send(full[0]?.key ?? "png-1x")} className={PANEL_CHIP} data-testid="marketing-export-run">
            Export {verdict.plan.zip ? "as a zip" : FORMAT_LABELS[verdict.plan.format]}
          </button>
        </>
      ) : (
        <Notice tone="warn" role="alert">
          {verdict.reason}
        </Notice>
      )}

      {note ? (
        <Notice tone="info" role="status">
          {note}
        </Notice>
      ) : null}
    </section>
  );
}

type ChoiceProps = Readonly<{ id: string; label: string; value: string; busy: boolean; onChange: (value: string) => void; children: React.ReactNode }>;

function Choice({ id, label, value, busy, onChange, children }: ChoiceProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <select id={id} className={PANEL_FIELD} value={value} disabled={busy} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

type SizeFieldProps = Readonly<{ id: string; label: string; value: string; busy: boolean; onChange: (value: string) => void }>;

function SizeField({ id, label, value, busy, onChange }: SizeFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <input id={id} type="text" inputMode="decimal" className={PANEL_FIELD} value={value} disabled={busy} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
