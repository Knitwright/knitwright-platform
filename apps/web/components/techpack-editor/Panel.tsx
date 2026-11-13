"use client";

import { Sheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { useRoving } from "@/components/ui/use-roving";
import type { StageCallout } from "@/lib/techpack/editor/stage";
import type { EditorTab, EditorTabId } from "@/lib/techpack/editor/tabs";
import type { ExtraPom, MeasurementMode } from "@/lib/techpack/view/measurements";
import type { TechPackView } from "@/lib/techpack/view/model";
import { LENGTH_UNITS, UNIT_LABELS, UNIT_NAMES, type LengthUnit } from "@/lib/techpack/view/units";
import { MeasurementsBody } from "./MeasurementsBody";
import { PartView, ProvenanceLegend } from "./Parts";
import type { StageSelection } from "./StageMarks";
import { CalloutsBody, OverviewBody } from "./TabBodies";

/**
 * The tech pack panel (spec screen 30): the seven pill tabs and mm / cm / in across the top, the
 * open tab's tables in a card, and under it the footnote and **Preview sheets**.
 */

type Props = Readonly<{
  tabs: readonly EditorTab[];
  tab: EditorTabId;
  onTab: (tab: EditorTabId) => void;
  unit: LengthUnit;
  onUnit: (unit: LengthUnit) => void;
  view: TechPackView;
  size: string;
  selection: StageSelection;
  onSelect: (selection: StageSelection) => void;
  callouts: readonly StageCallout[];
  onMode: (mode: MeasurementMode) => void;
  onAddMeasurement: (extra: ExtraPom) => void;
  onAddCallout: (() => void) | null;
  onRemoveCallout: ((markId: string) => void) | null;
  busy: boolean;
  onPreview: () => void;
  footnote: string;
}>;

export const panelIdOf = (id: EditorTabId): string => `techpack-panel-${id}`;
export const tabIdOf = (id: EditorTabId): string => `techpack-tab-${id}`;

export function Panel(props: Props) {
  const open = props.tabs.find((entry) => entry.id === props.tab) ?? props.tabs[0];
  return (
    <section aria-label="Tech pack" className="flex min-h-0 min-w-0 flex-col gap-3 lg:w-180 lg:shrink-0" data-testid="tp-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabBar tabs={props.tabs} tab={props.tab} onTab={props.onTab} />
        <UnitToggle unit={props.unit} onUnit={props.onUnit} />
      </div>
      {open ? (
        <div
          role="tabpanel"
          id={panelIdOf(open.id)}
          aria-labelledby={tabIdOf(open.id)}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-bg py-2 shadow-e1"
          data-testid={`tp-tab-${open.id}`}
        >
          <TabBody {...props} open={open} />
        </div>
      ) : null}
      <ProvenanceLegend counts={props.view.counts} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted">{props.footnote}</p>
        <Button variant="secondary" size="sm" icon={<Icon icon={Sheet} size={16} />} onClick={props.onPreview} data-testid="tp-preview-sheets">
          Preview sheets
        </Button>
      </div>
    </section>
  );
}

function TabBody(props: Props & Readonly<{ open: EditorTab }>) {
  const { open } = props;
  if (open.id === "overview") return <OverviewBody tab={open} review={props.view.review} onGo={props.onTab} />;
  if (open.id === "measurements") {
    return (
      <MeasurementsBody
        tab={open}
        view={props.view.measurements}
        size={props.size}
        selection={props.selection}
        onSelect={props.onSelect}
        onMode={props.onMode}
        onAdd={props.onAddMeasurement}
      />
    );
  }
  if (open.id === "callouts") {
    return (
      <CalloutsBody
        tab={open}
        callouts={props.callouts}
        selection={props.selection}
        onSelect={props.onSelect}
        onAdd={props.onAddCallout}
        onRemove={props.onRemoveCallout}
        busy={props.busy}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {open.parts.map((part) => (
        <PartView key={part.from} part={part} />
      ))}
    </div>
  );
}

function TabBar({
  tabs,
  tab,
  onTab,
}: Readonly<{
  tabs: readonly EditorTab[];
  tab: EditorTabId;
  onTab: (tab: EditorTabId) => void;
}>) {
  const roving = useRoving<HTMLButtonElement>(tabs.length, (index) => {
    const next = tabs[index];
    if (next) onTab(next.id);
  });
  return (
    <div role="tablist" aria-label="Tech pack tabs" className="flex flex-wrap items-center gap-1" data-testid="techpack-tabs">
      {tabs.map((entry, index) => {
        const on = entry.id === tab;
        return (
          <button
            key={entry.id}
            ref={roving.ref(index)}
            type="button"
            role="tab"
            id={tabIdOf(entry.id)}
            aria-selected={on}
            aria-controls={on ? panelIdOf(entry.id) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onTab(entry.id)}
            onKeyDown={roving.onKeyDown(index)}
            className={cx(
              "h-8 rounded-md px-3 text-small font-semibold transition-colors duration-fast ease-out",
              on ? "bg-navy text-on-dark" : "text-text-2 live:hover:bg-soft",
            )}
            data-testid={tabIdOf(entry.id)}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

function UnitToggle({ unit, onUnit }: Readonly<{ unit: LengthUnit; onUnit: (unit: LengthUnit) => void }>) {
  const roving = useRoving<HTMLButtonElement>(LENGTH_UNITS.length, (index) => {
    const next = LENGTH_UNITS[index];
    if (next) onUnit(next);
  });
  return (
    <div role="radiogroup" aria-label="Units" className="inline-flex items-center gap-0.5" data-testid="techpack-units">
      {LENGTH_UNITS.map((id, index) => {
        const on = id === unit;
        return (
          <button
            key={id}
            ref={roving.ref(index)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onUnit(id)}
            onKeyDown={roving.onKeyDown(index)}
            className={cx("h-8 rounded-md px-2.5 text-small font-semibold", on ? "bg-bg text-text shadow-e1" : "text-text-2 live:hover:text-text")}
            data-testid={`techpack-unit-${id}`}
          >
            <span aria-hidden="true">{UNIT_LABELS[id]}</span>
            <span className="sr-only">{UNIT_NAMES[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
