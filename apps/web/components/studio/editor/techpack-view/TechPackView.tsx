"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { autoDesignName, type EditorSlotProps } from "@/lib/editor";
import {
  LENGTH_UNITS,
  TAB_LABELS,
  TECHPACK_TABS,
  UNIT_LABELS,
  UNIT_NAMES,
  buildTechPackView,
  tabKeyTarget,
  tabPanelId,
  tabTestId,
  type ExtraPom,
  type LengthUnit,
  type MeasurementMode,
  type OverviewHeader,
  type TechPackTabId,
} from "@/lib/techpack/view";
import { marksKey, useMarks } from "../specs/marks-store";
import { ChipLegend } from "./Chips";
import { MeasurementsTab } from "./MeasurementsTab";
import { ReviewTab } from "./ReviewTab";
import { TabSections } from "./Sections";

/**
 * The **tech pack view** (spec F-S6), and the slot `tech-pack` of the editor shell's contract: the
 * third view of the design, with its eleven tabs, its mm | cm | in toggle and its provenance chips.
 *
 * It fetches nothing. Everything it draws is `buildTechPackView` over what the slot contract hands
 * it, so the panel, the Excel and the PDF read the same numbers from the same call
 * (`lib/techpack/view/export-values.ts`). What the person chooses here — the open tab, the unit,
 * the Measurement | Grading toggle and the points of measure they added — is this panel's own
 * state, because none of it is part of the design.
 */

/**
 * What the Overview tab's header fields can be read from the slot contract. Only the form's own line
 * can: the brand, the collection, the season, the design's typed name and the factory are not part of
 * `EditorDesign`, so they are left empty and the tab asks for them rather than guessing at one.
 */
const headerOf = (design: EditorSlotProps["design"]): OverviewHeader => ({
  styleName: null,
  formName: autoDesignName(design.article, design.form),
  brand: null,
  collection: null,
  season: null,
  factory: null,
});

export default function TechPackView({ design, commands }: EditorSlotProps) {
  const [tab, setTab] = useState<TechPackTabId>("overview");
  const [unit, setUnit] = useState<LengthUnit>("mm");
  const [mode, setMode] = useState<MeasurementMode>("measurement");
  const [extras, setExtras] = useState<readonly ExtraPom[]>([]);
  const { marks } = useMarks(marksKey(design.projectId, design.version));
  const tabs = useRef(new Map<TechPackTabId, HTMLButtonElement>());

  const view = buildTechPackView({
    spec: design.spec,
    article: design.article,
    header: headerOf(design),
    size: design.size,
    sizes: design.sizes,
    colourwayId: design.colourwayId,
    marks,
    extras,
    unit,
    mode,
  });

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = tabKeyTarget(tab, event.key);
    if (!target) return;
    event.preventDefault();
    setTab(target);
    tabs.current.get(target)?.focus();
  };

  const open = view.tabs.find((entry) => entry.id === tab) ?? view.tabs[0];

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="techpack-view">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipLegend counts={view.counts} />
        <UnitToggle unit={unit} onUnit={setUnit} />
      </div>
      <TabBar tab={tab} blocked={view.review.exportBlocked} tabs={tabs} onMove={move} onChoose={setTab} />
      <div id={tabPanelId(tab)} role="tabpanel" aria-labelledby={tabTestId(tab)} className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {tab === "measurements" ? (
          <MeasurementsTab
            view={view.measurements}
            autoMap={view.autoMap}
            shownSize={design.size}
            busy={design.busy}
            onMode={setMode}
            onAdd={(extra) => setExtras((all) => [...all, extra])}
          />
        ) : tab === "review" ? (
          <ReviewTab review={view.review} onGoToTab={setTab} />
        ) : open ? (
          <TabSections view={open} />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => commands.showView("tech-pack")}
        className="chip-btn min-h-10 self-start rounded-full border border-white/20 px-4 text-sm font-medium text-ink"
        data-testid="techpack-only"
      >
        Show the tech pack on its own
      </button>
    </div>
  );
}

type BarProps = Readonly<{
  tab: TechPackTabId;
  /** True while something on the Review tab stops the export: the Review tab carries a mark. */
  blocked: boolean;
  tabs: { current: Map<TechPackTabId, HTMLButtonElement> };
  onMove: (event: KeyboardEvent<HTMLDivElement>) => void;
  onChoose: (tab: TechPackTabId) => void;
}>;

/** The tab bar: one tab stop for the whole bar, and the arrow keys move within it. */
function TabBar({ tab, blocked, tabs, onMove, onChoose }: BarProps) {
  return (
    <div role="tablist" aria-label="Tech pack tabs" aria-orientation="horizontal" onKeyDown={onMove} className="flex flex-wrap gap-1" data-testid="techpack-tabs">
      {TECHPACK_TABS.map((id) => {
        const selected = id === tab;
        return (
          <button
            key={id}
            ref={(element) => {
              if (element) tabs.current.set(id, element);
              else tabs.current.delete(id);
            }}
            id={tabTestId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tabPanelId(id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChoose(id)}
            data-testid={tabTestId(id)}
            className={`inline-flex min-h-10 items-center rounded-xl px-3 text-[11px] font-medium ${selected ? "bg-cobalt text-white" : "text-chalk-muted hover:text-ink"}`}
          >
            {TAB_LABELS[id]}
            {id === "review" && blocked ? <span className="ml-1 text-warn" aria-label="something stops the export">&#9888;</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function UnitToggle({ unit, onUnit }: Readonly<{ unit: LengthUnit; onUnit: (unit: LengthUnit) => void }>) {
  return (
    <div role="radiogroup" aria-label="Units" className="flex items-center gap-1 rounded-2xl bg-tile-2/70 p-1" data-testid="techpack-units">
      {LENGTH_UNITS.map((id) => (
        <label key={id} htmlFor={`techpack-unit-${id}`} className="flex min-h-10 items-center gap-1 px-2 text-[13px] text-ink">
          <input
            id={`techpack-unit-${id}`}
            type="radio"
            name="techpack-unit"
            value={id}
            checked={id === unit}
            onChange={() => onUnit(id)}
            className="size-4 accent-cobalt"
          />
          <span aria-hidden="true">{UNIT_LABELS[id]}</span>
          <span className="sr-only">{UNIT_NAMES[id]}</span>
        </label>
      ))}
    </div>
  );
}
