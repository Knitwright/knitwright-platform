"use client";

import { useMemo, useState } from "react";
import { PriceNote } from "@/components/credits/PriceNote";
import type { EditorSlotProps } from "@/lib/editor/slots";
import {
  CHARGE_WORDS,
  PANEL_TABS,
  RECOMMENDED_IMAGE_SIZE,
  type ExportOutput,
  type ExportPanelTab,
  type ExportPanelTabId,
  type PanelInput,
} from "@/lib/techpack/exports/panel";
import { outputsFor } from "@/lib/techpack/exports/panel-outputs";
import { exportGate, reviewFromDesign, type ExportGate } from "@/lib/techpack/exports/review-gate";
import { Preview } from "./Preview";
import { TabOptions, type OptionState } from "./TabOptions";

/**
 * THE EXPORT PANEL (spec F-S6; plan v5 Y5, decision 0078).
 *
 * A slot of the editor shell (`lib/editor/slots.ts`): it takes the design and the commands and
 * nothing else, and it never fetches. A live preview sits on the left and the specification's six
 * tabs across the top. Every address it offers is a route that exists; an output the platform
 * cannot make yet says so in plain words instead of showing a button that would fail.
 *
 * Export is shut while the Review tab still asks for something (`review-gate.ts`). There is no way
 * round the gate in this panel: when it is shut, no address is shown at all.
 */

const START: OptionState = {
  images: { view: "front", type: "svg", size: RECOMMENDED_IMAGE_SIZE, withMannequin: false, withBackground: false },
  pattern: { format: "pdf-1-1", withArtwork: true, withMeasurements: false },
  everySize: false,
};

const TAB = "min-h-10 rounded-full px-3 py-1 text-[13px]";

function Tabs({ open, onOpen }: Readonly<{ open: ExportPanelTabId; onOpen: (id: ExportPanelTabId) => void }>) {
  return (
    <div role="tablist" aria-label="What to export" className="flex flex-wrap gap-1">
      {PANEL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`export-tab-${tab.id}`}
          aria-selected={open === tab.id}
          aria-controls="export-tab-panel"
          className={`${TAB} ${open === tab.id ? "bg-tile-2 text-ink" : "text-chalk-muted"}`}
          onClick={() => onOpen(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** What the gate says, and what has to be done first. Nothing is downloadable while it is shut. */
function Gate({ gate }: Readonly<{ gate: ExportGate }>) {
  return (
    <div className="flex flex-col gap-1" data-testid="export-gate">
      {gate.reason === null ? null : (
        <p className="text-[13px] leading-relaxed text-warn" role="status">
          {gate.reason}
        </p>
      )}
      {gate.items.length === 0 ? null : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-chalk-muted">
          {gate.items.map((item) => (
            <li key={item.key}>
              {item.label} <span className="font-mono text-[11px]">{item.ruleId}</span>
            </li>
          ))}
        </ul>
      )}
      {gate.caution === null ? null : <p className="text-[12px] leading-relaxed text-chalk-muted">{gate.caution}</p>}
    </div>
  );
}

/** One file to download, or one plain sentence saying why there is none yet. */
function Output({ output, busy }: Readonly<{ output: ExportOutput; busy: boolean }>) {
  if (output.address === null) {
    return (
      <li className="text-[13px] leading-relaxed text-chalk-muted" data-testid={`export-not-yet-${output.id}`}>
        <span className="text-ink">{output.label}:</span> {output.notYet}
      </li>
    );
  }
  return (
    <li>
      <a
        href={output.address}
        aria-disabled={busy}
        data-testid={`export-output-${output.id}`}
        className={`text-[13px] font-medium underline ${busy ? "pointer-events-none text-chalk-muted" : "text-ink"}`}
      >
        {output.label}
      </a>
    </li>
  );
}

function TabBody({ tab, outputs, gate, busy }: Readonly<{ tab: ExportPanelTab; outputs: readonly ExportOutput[]; gate: ExportGate; busy: boolean }>) {
  return (
    <div id="export-tab-panel" role="tabpanel" aria-labelledby={`export-tab-${tab.id}`} className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-chalk-muted">
        {tab.lead} {CHARGE_WORDS[tab.charge]}
      </p>
      {gate.open ? (
        <ul className="flex flex-col gap-2" data-testid="export-outputs">
          {outputs.map((output) => (
            <Output key={output.id} output={output} busy={busy} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-relaxed text-chalk-muted" data-testid="export-shut">
          No file is offered while export is blocked.
        </p>
      )}
      {tab.kind === null ? null : <PriceNote kind={tab.kind} />}
    </div>
  );
}

/** The Export panel. It is the default export, so the shell can load it with `next/dynamic`. */
export default function ExportPanel({ design }: EditorSlotProps) {
  const [open, setOpen] = useState<ExportPanelTabId>("tech-pack");
  const [options, setOptions] = useState<OptionState>(START);
  const gate = useMemo(() => exportGate(reviewFromDesign(design)), [design]);
  const input: PanelInput = useMemo(
    () => ({
      projectId: design.projectId,
      version: design.version,
      colourwayId: design.colourwayId,
      size: design.size,
      views: ["front", "back"],
    }),
    [design.projectId, design.version, design.colourwayId, design.size],
  );
  const tab = PANEL_TABS.find((entry) => entry.id === open) ?? PANEL_TABS[0];
  const outputs = useMemo(() => outputsFor(tab.id, input, options), [tab.id, input, options]);
  return (
    <section aria-label="Export" data-testid="editor-export-panel" className="flex flex-col gap-4 rounded-2xl border border-white/10 p-4 lg:flex-row">
      <div className="lg:w-1/2">
        <Preview design={design} />
      </div>
      <div className="flex flex-col gap-3 lg:w-1/2">
        <Tabs open={open} onOpen={setOpen} />
        <Gate gate={gate} />
        <TabOptions tab={tab.id} options={options} onChange={setOptions} />
        <TabBody tab={tab} outputs={outputs} gate={gate} busy={design.busy} />
      </div>
    </section>
  );
}
