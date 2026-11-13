"use client";

import { Crown, Download } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useState } from "react";
import { NOT_WIRED, useMarketingServices } from "@/components/marketing/services";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Checkbox, Select } from "@/components/ui/Inputs";
import { Notice } from "@/components/ui/Notice";
import { boardFilePath } from "@/lib/flows";
import { ARTBOARD_UNITS, UNIT_SUFFIX, writeLength, type ArtboardUnit, type BoardView } from "@/lib/launch";
import {
  COLOUR_SPACES,
  COLOUR_SPACE_LABELS,
  FORMAT_LABELS,
  colourNote,
  dpiOffered,
  exportVerdict,
  formatsOffered,
  ruleForPlan,
  type ColourSpace,
  type FileFormat,
} from "@/lib/marketing";
import { artboardsOf, checklistLabel, garmentOutputs, sharedFigure } from "@/lib/order-boards/canvas";
import type { OrderableDesign } from "@/lib/order-boards/types";
import { PanelFrame } from "./PanelFrame";

/**
 * THE EXPORT POPOVER (plan v6 E4, decision 0148; `08` §5.7 and v3.6, e27): the artboard checklist,
 * W · H · unit, format · dpi, colour, the additional settings, and the Garment board block.
 *
 * Every choice goes through the marketing export panel's own rules (`exportVerdict`, decision 0094),
 * so the popover shows what it would make or the sentence saying why it cannot. Making the artboard
 * files is not wired yet -- the launch shell's `onExport` is null -- and the popover says so rather
 * than pretending. The Garment board block is real: the tech pack routes and the production package
 * route answer it.
 */

const unitOf = (value: string): ArtboardUnit => ARTBOARD_UNITS.find((one) => one === value) ?? "px";

export function ExportPopover({
  boards,
  design,
  unit: projectUnit,
  selectedId = null,
  onClose,
}: Readonly<{ boards: readonly BoardView[]; design: OrderableDesign | null; unit: ArtboardUnit; selectedId?: string | null; onClose: () => void }>) {
  const { targets, watermarkRules, plan, cmykProfile, onExport } = useMarketingServices();
  const ids = { list: useId(), unit: useId(), format: useId(), dpi: useId(), space: useId() };
  const artboards = artboardsOf(boards);
  const [chosen, setChosen] = useState<readonly string[]>(() => artboards.map((board) => board.id));
  const [listOpen, setListOpen] = useState(false);
  const [unit, setUnit] = useState<ArtboardUnit>(projectUnit);
  const [format, setFormat] = useState<FileFormat>("png");
  const [dpi, setDpi] = useState<number>(dpiOffered(targets)[0] ?? 72);
  const [space, setSpace] = useState<ColourSpace>("rgb");
  const [note, setNote] = useState<string | null>(null);

  const picked = artboards.filter((board) => chosen.includes(board.id));
  const first = picked[0];
  const rule = ruleForPlan(watermarkRules, plan);
  const verdict =
    first === undefined
      ? null
      : exportVerdict({
          boards: picked.map((board) => ({ id: board.id, name: board.name, size: board.size })),
          width: Number(writeLength(first.size.width, unit, dpi)),
          height: Number(writeLength(first.size.height, unit, dpi)),
          unit,
          dpi,
          format,
          colourSpace: space,
          removeBackground: false,
          rule,
          cmykProfile: cmykProfile !== null,
        });

  const all = chosen.length === artboards.length;
  const toggle = (id: string, on: boolean) => setChosen(on ? [...chosen, id] : chosen.filter((one) => one !== id));
  const send = () => {
    if (onExport === null || verdict === null || !verdict.ok) return setNote(NOT_WIRED);
    setNote(null);
    onExport({ boardIds: picked.map((board) => board.id), targetKey: "custom" });
  };

  return (
    <PanelFrame title="Export" onClose={onClose} testId="export-popover">
      {artboards.length === 0 ? (
        <p className="text-small text-muted">There is no artboard on this canvas yet. Add one from Tools or the task bar.</p>
      ) : (
        <>
          <div className="relative flex flex-col gap-1">
            <button
              type="button"
              aria-expanded={listOpen}
              aria-controls={ids.list}
              onClick={() => setListOpen(!listOpen)}
              className="flex h-10 items-center justify-between rounded-md border border-border bg-bg px-3 text-body text-text live:hover:bg-soft"
              data-testid="export-artboards"
            >
              {checklistLabel(chosen.length, artboards.length)}
              <span aria-hidden="true">⌄</span>
            </button>
            <div id={ids.list} hidden={!listOpen} className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-border px-3">
              <Checkbox label={`All artboards (${artboards.length})`} checked={all} onChange={(event) => setChosen(event.target.checked ? artboards.map((b) => b.id) : [])} />
              {artboards.map((board) => (
                <Checkbox key={board.id} label={board.name || "Untitled artboard"} checked={chosen.includes(board.id)} onChange={(event) => toggle(board.id, event.target.checked)} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Figure label="W" value={sharedFigure(picked.map((board) => Number(writeLength(board.size.width, unit, dpi))))} />
            <Figure label="H" value={sharedFigure(picked.map((board) => Number(writeLength(board.size.height, unit, dpi))))} />
            <Select id={ids.unit} aria-label="Unit" value={unit} onChange={(event) => setUnit(unitOf(event.target.value))}>
              {ARTBOARD_UNITS.map((one) => (
                <option key={one} value={one}>
                  {UNIT_SUFFIX[one]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select id={ids.format} aria-label="Format" value={format} onChange={(event) => setFormat(event.target.value as FileFormat)}>
              {formatsOffered(targets).map((one) => (
                <option key={one} value={one}>
                  {FORMAT_LABELS[one]}
                </option>
              ))}
            </Select>
            <Select id={ids.dpi} aria-label="Resolution (dpi)" value={String(dpi)} onChange={(event) => setDpi(Number(event.target.value))}>
              {dpiOffered(targets).map((one) => (
                <option key={one} value={one}>
                  {one} dpi
                </option>
              ))}
            </Select>
          </div>
          {verdict !== null && !verdict.ok ? (
            <p className="text-caption text-warn" role="alert" data-testid="export-refusal">
              {verdict.reason}
            </p>
          ) : verdict?.ok && verdict.plan.watermark ? (
            <p className="text-caption text-muted">{rule?.label} exports carry the Knitwright preview mark.</p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-small font-semibold text-text">Color</h3>
            <Select id={ids.space} aria-label="Color" value={space} onChange={(event) => setSpace(event.target.value as ColourSpace)}>
              {COLOUR_SPACES.map((one) => (
                <option key={one} value={one}>
                  {COLOUR_SPACE_LABELS[one]}
                </option>
              ))}
            </Select>
            <p className="text-caption text-muted">{colourNote(space, cmykProfile)}</p>
          </div>

          <div className="flex flex-col">
            <h3 className="text-small font-semibold text-text">Additional settings</h3>
            {(["Transparent background", "Optimize quality"] as const).map((label) => (
              <Checkbox
                key={label}
                disabled
                label={
                  <span className="inline-flex items-center gap-1.5">
                    {label}
                    <Icon icon={Crown} size={14} className="text-gold" />
                    <span className="sr-only">, on paid plans</span>
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}

      <BoardFile board={boards.find((board) => board.id === selectedId) ?? null} />
      <GarmentBlock design={design} />

      {artboards.length === 0 ? null : (
        <Button variant="primary" className="w-full" onClick={send} disabled={picked.length === 0} data-testid="export-run">
          Export
        </Button>
      )}
      {note ? (
        <Notice tone="info" role="status">
          {note}
        </Notice>
      ) : null}
    </PanelFrame>
  );
}

function Figure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <p className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-body text-text">
      <span aria-hidden="true" className="text-muted">
        {label}
      </span>
      <span className="sr-only">{label === "W" ? "Width" : "Height"}</span>
      <span>{value}</span>
    </p>
  );
}

/** "Garment board (Knitwright)": the tech pack and the production package of the design. */
function GarmentBlock({ design }: Readonly<{ design: OrderableDesign | null }>) {
  if (design === null) return null;
  return (
    <section aria-labelledby="export-garment" className="flex flex-col gap-1.5 border-t border-border pt-3" data-testid="export-garment">
      <h3 id="export-garment" className="text-small font-semibold text-text">
        Garment board <span className="font-normal text-muted">· {design.name}</span>
      </h3>
      <ul className="flex flex-col gap-1">
        {garmentOutputs(design).map((output) => (
          <li key={output.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-body text-text">{output.label}</span>
              <span className="block text-caption text-muted">{output.note}</span>
            </span>
            <a href={output.href} download className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border px-3 text-small font-semibold text-text live:hover:bg-soft" data-testid={`export-${output.id}`}>
              <Icon icon={Download} size={14} />
              Download
              <span className="sr-only"> {output.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <Link href={`/studio/${design.id}/tech-pack` as Route} className="self-start text-small font-semibold text-link live:hover:underline" data-testid="export-techpack-page">
        Open the tech pack and production files
      </Link>
    </section>
  );
}

/** The selected board's own file, once it has run (E2's interim Export door, kept). */
function BoardFile({ board }: Readonly<{ board: BoardView | null }>) {
  if (board?.outputFileId == null) return null;
  return (
    <a href={boardFilePath(board.outputFileId)} target="_blank" rel="noopener" className="self-start text-small font-semibold text-link live:hover:underline" data-testid="export-board-file">
      Download {board.name || "this board"} as it last ran
    </a>
  );
}
