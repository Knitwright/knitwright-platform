"use client";

import { useEffect, useId, useState } from "react";
import type { EditorSlotProps } from "@/lib/editor";
import { panelsFor } from "@/lib/garment";
import {
  SPEC_TOOLS,
  TOOL_HELP,
  TOOL_LABELS,
  isDrawingTool,
  liveLength,
  makeMark,
  pendingPick,
  polylineLengthMm,
  type PickedPoint,
  type SpecMark,
  type SpecTool,
} from "@/lib/techpack/view";
import { WhyButton } from "../WhyButton";
import { marksKey, useMarks } from "./marks-store";
import { listenForPicks, pickingNote } from "./pick-bus";

/**
 * The **Specs** toolbar of the editor's left rail (spec F-S4), and the slot `specs` of the editor
 * shell's contract: Select, Measure point, Measure line, Measure edge and Callout.
 *
 * A tool is held, places are picked, and what is picked becomes a mark the tech pack view reads —
 * a measure mark becomes an extra point of measure on the Measurements tab, and a callout becomes a
 * numbered row on the Callouts tab. All of the thinking is in `lib/techpack/view/marks.ts`, which
 * is tested without a browser; this file only draws it.
 *
 * Two things it says plainly rather than hiding:
 *
 * - **No view reports a click yet** (`pick-bus.ts`). The place is given in the fields below, which
 *   is also how a person who cannot use a pointer gives one, so the tool is never pointer-only.
 * - **A mark is not saved.** There is no `SpecAction` that stores a founder's own point of measure
 *   (`marks-store.ts` says why), so a reload loses what was drawn. The panel says so.
 */

const NOT_SAVED = "A mark you draw shows on the tech pack straight away. It is not saved with the design yet, so a reload loses it.";
const GAP_RULE = "R-GAP-000";

export default function SpecsToolbar({ design, commands }: EditorSlotProps) {
  const key = marksKey(design.projectId, design.version);
  const { marks, add, remove, clear } = useMarks(key);
  const [tool, setTool] = useState<SpecTool>("select");
  const [points, setPoints] = useState<readonly PickedPoint[]>([]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const groupId = useId();

  // A view that learns to report a click is heard here, while a drawing tool is held.
  useEffect(() => {
    if (!isDrawingTool(tool)) return undefined;
    return listenForPicks((point) => setPoints((picked) => [...picked, point]));
  }, [tool]);

  const chooseTool = (next: SpecTool) => {
    setTool(next);
    setPoints([]);
  };

  const pending = pendingPick(tool, points.length);
  const length = polylineLengthMm(points);

  const keep = () => {
    const mark = makeMark({ id: `${key}-${marks.length + 1}-${tool}`, tool, label, note, points, drawnOn: "2d" });
    if (!mark) return;
    add(mark);
    setPoints([]);
    setLabel("");
    setNote("");
    // The tech pack is where the mark lands, so take the person there.
    commands.showView("tech-pack", true);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="specs-toolbar">
      <Tools tool={tool} groupId={groupId} busy={design.busy} onChoose={chooseTool} />
      {isDrawingTool(tool) ? (
        <Picker
          points={points}
          prompt={pending.prompt}
          ready={pending.ready}
          length={liveLength(length, "mm")}
          label={label}
          note={note}
          busy={design.busy}
          panels={panelsFor(design.spec).map((panel) => ({ id: panel.id, label: panel.label }))}
          onPick={(point) => setPoints((picked) => [...picked, point])}
          onUndo={() => setPoints((picked) => picked.slice(0, -1))}
          onLabel={setLabel}
          onNote={setNote}
          onKeep={keep}
        />
      ) : (
        <p className="text-[13px] leading-relaxed text-chalk-muted">{TOOL_HELP.select}</p>
      )}
      <Marks marks={marks} onRemove={remove} onClear={clear} />
      <p className="flex flex-wrap items-center gap-1 text-[11px] text-warn" data-testid="specs-not-saved">
        <span aria-hidden="true">&#9888;</span>
        <span>{NOT_SAVED}</span>
        <WhyButton ruleId={GAP_RULE} context="specs toolbar mark" />
      </p>
    </div>
  );
}

type ToolsProps = Readonly<{ tool: SpecTool; groupId: string; busy: boolean; onChoose: (tool: SpecTool) => void }>;

/** The five tools, as one radio group, so the arrow keys move between them as a group of radios does. */
function Tools({ tool, groupId, busy, onChoose }: ToolsProps) {
  return (
    <div role="radiogroup" aria-labelledby={`${groupId}-legend`} className="rounded-2xl border border-white/10 p-3" data-testid="specs-tools">
      <p id={`${groupId}-legend`} className="px-1 font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">
        Specs tools
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {SPEC_TOOLS.map((id) => (
          <label key={id} htmlFor={`${groupId}-${id}`} className="flex min-h-10 items-center gap-3 text-[13px] text-ink">
            <input
              id={`${groupId}-${id}`}
              type="radio"
              name={`${groupId}-tool`}
              value={id}
              checked={id === tool}
              disabled={busy}
              aria-describedby={`${groupId}-${id}-help`}
              onChange={() => onChoose(id)}
              className="size-4 shrink-0 accent-cobalt"
            />
            <span className="min-w-0 flex-1">
              {TOOL_LABELS[id]}
              <span id={`${groupId}-${id}-help`} className="block text-[11px] text-chalk-muted">
                {TOOL_HELP[id]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

type PickerProps = Readonly<{
  points: readonly PickedPoint[];
  prompt: string;
  ready: boolean;
  length: string | null;
  label: string;
  note: string;
  busy: boolean;
  panels: readonly Readonly<{ id: string; label: string }>[];
  onPick: (point: PickedPoint) => void;
  onUndo: () => void;
  onLabel: (text: string) => void;
  onNote: (text: string) => void;
  onKeep: () => void;
}>;

/** Where a place is given, what has been picked so far, and the live length of the line. */
function Picker(props: PickerProps) {
  const id = useId();
  const [panelId, setPanelId] = useState(props.panels[0]?.id ?? "front");
  const [xMm, setXMm] = useState("0");
  const [yMm, setYMm] = useState("0");
  const pick = () => props.onPick({ panelId, xMm: Number(xMm), yMm: Number(yMm) });
  const numbersGiven = Number.isFinite(Number(xMm)) && Number.isFinite(Number(yMm)) && xMm.trim() !== "" && yMm.trim() !== "";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 p-3" data-testid="specs-picker">
      <p className="text-[13px] leading-relaxed text-ink" role="status" data-testid="specs-prompt">
        {props.prompt}
      </p>
      <p className="text-[11px] leading-relaxed text-chalk-muted">{pickingNote()}</p>
      <label htmlFor={`${id}-panel`} className="text-[11px] text-chalk-muted">
        Panel
      </label>
      <select
        id={`${id}-panel`}
        value={panelId}
        disabled={props.busy}
        onChange={(event) => setPanelId(event.target.value)}
        className="min-h-10 rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      >
        {props.panels.map((panel) => (
          <option key={panel.id} value={panel.id}>
            {panel.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <NumberField label="Across, mm" id={`${id}-x`} value={xMm} busy={props.busy} onChange={setXMm} />
        <NumberField label="Down, mm" id={`${id}-y`} value={yMm} busy={props.busy} onChange={setYMm} />
      </div>
      <button type="button" onClick={pick} disabled={props.busy || !numbersGiven} className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-ink">
        Pick this place
      </button>
      <p className="text-[11px] text-chalk-muted" data-testid="specs-picked">
        {props.points.length === 0 ? "Nothing picked yet." : `${props.points.length} place(s) picked.`}
        {props.length === null ? "" : ` Length so far ${props.length} mm.`}
      </p>
      <label htmlFor={`${id}-label`} className="text-[11px] text-chalk-muted">
        What to call it
      </label>
      <input
        id={`${id}-label`}
        type="text"
        value={props.label}
        maxLength={60}
        disabled={props.busy}
        onChange={(event) => props.onLabel(event.target.value)}
        className="min-h-10 rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      />
      <label htmlFor={`${id}-note`} className="text-[11px] text-chalk-muted">
        Note for the factory
      </label>
      <input
        id={`${id}-note`}
        type="text"
        value={props.note}
        maxLength={200}
        disabled={props.busy}
        onChange={(event) => props.onNote(event.target.value)}
        className="min-h-10 rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={props.onKeep}
          disabled={props.busy || !props.ready}
          className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
          data-testid="specs-keep"
        >
          Keep the mark
        </button>
        <button
          type="button"
          onClick={props.onUndo}
          disabled={props.busy || props.points.length === 0}
          className="chip-btn min-h-10 rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
        >
          Undo the last place
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, id, value, busy, onChange }: Readonly<{ label: string; id: string; value: string; busy: boolean; onChange: (text: string) => void }>) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] text-chalk-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full rounded-xl border border-white/20 bg-tile-2 px-2 text-[13px] text-ink"
      />
    </span>
  );
}

type MarksProps = Readonly<{ marks: readonly SpecMark[]; onRemove: (id: string) => void; onClear: () => void }>;

/** What has been drawn, so a person can see it and take it off again. */
function Marks({ marks, onRemove, onClear }: MarksProps) {
  if (marks.length === 0) {
    return (
      <p className="text-[11px] text-chalk-muted" data-testid="specs-marks-none">
        Nothing is drawn on this design yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1" data-testid="specs-marks">
      <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Drawn on this design</p>
      <ul className="flex flex-col gap-1">
        {marks.map((mark) => (
          <li key={mark.id} className="flex min-h-10 items-center gap-2 text-[13px] text-ink">
            <span className="min-w-0 flex-1">
              <span className="font-mono text-[11px] text-chalk-muted">{TOOL_LABELS[mark.tool]}</span> {mark.label}
              {mark.lengthMm === null ? null : <span className="block text-[11px] text-ink-2">{mark.lengthMm} mm</span>}
            </span>
            <button type="button" onClick={() => onRemove(mark.id)} className="min-h-10 px-2 text-[13px] font-medium text-ink underline">
              Take off
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClear} className="min-h-10 self-start px-2 text-[13px] font-medium text-ink underline">
        Take all of them off
      </button>
    </div>
  );
}
