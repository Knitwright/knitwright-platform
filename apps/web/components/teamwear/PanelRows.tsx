"use client";

import type { Wearer } from "@/lib/garment";
import { wearerLabel } from "@/lib/projects/wearers";
import { CLUB_PALETTE, type ClubColours } from "@/lib/kit-styles/presets";
import { ELEMENT_SLOT_LABELS, type ElementSlotId, type PanelRow } from "@/lib/teamwear";

/**
 * One row of the right panel's accordion (spec F-T1). Closed, it shows its value as a short
 * catalogue code; open, it shows the control for that decision. Every control is built from the
 * base article's own options and ranges, so a value the factory does not make cannot be reached: an
 * option is a radio over the article's codes and a parameter is a slider with the article's own
 * ends and step.
 */

export interface RowHandlers {
  readonly setWearer: (wearer: Wearer) => void;
  readonly setColour: (role: "main" | "second" | "third" | "socks", swatch: string | null) => void;
  readonly setOption: (group: string, code: string) => void;
  readonly setParameter: (key: string, mm: number) => void;
  readonly setElement: (slot: ElementSlotId, filled: boolean) => void;
  readonly setNamesNumbers: (on: boolean) => void;
}

const FIELD = "h-11 w-full rounded-xl border border-white/20 bg-black/20 px-3 text-[15px] text-ink";

function ColourPicker({ label, value, onPick }: Readonly<{ label: string; value: string | null; onPick: (swatch: string | null) => void }>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <select className={FIELD} value={value ?? ""} onChange={(event) => onPick(event.target.value === "" ? null : event.target.value)}>
        <option value="">Not chosen</option>
        {CLUB_PALETTE.map((colour) => (
          <option key={colour.swatch} value={colour.swatch}>
            {colour.name}
          </option>
        ))}
      </select>
    </label>
  );
}

type RowProps = Readonly<{ row: PanelRow; colours: ClubColours; socksColour: string; isSocks: boolean; handlers: RowHandlers }>;

/** The control a row opens. Each one writes through a handler, which checks it against the article. */
export function RowControl({ row, colours, socksColour, isSocks, handlers }: RowProps) {
  if (row.kind === "model") {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Made for</span>
          <select className={FIELD} value={row.wearer} onChange={(event) => handlers.setWearer(event.target.value as Wearer)} data-testid="teamwear-wearer">
            {row.wearers.map((wearer) => (
              <option key={wearer} value={wearer}>
                {wearerLabel(wearer)}
              </option>
            ))}
          </select>
        </label>
        {row.note === null ? null : <p className="text-xs text-muted">{row.note}</p>}
      </div>
    );
  }
  if (row.kind === "colours") {
    return isSocks ? (
      <ColourPicker label="Socks" value={socksColour} onPick={(swatch) => handlers.setColour("socks", swatch)} />
    ) : (
      <div className="flex flex-col gap-2">
        <ColourPicker label="Main colour" value={colours.main} onPick={(swatch) => handlers.setColour("main", swatch)} />
        <ColourPicker label="Second colour" value={colours.second} onPick={(swatch) => handlers.setColour("second", swatch)} />
        <ColourPicker label="Third colour" value={colours.third} onPick={(swatch) => handlers.setColour("third", swatch)} />
      </div>
    );
  }
  if (row.kind === "options") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{row.label}</legend>
        {row.group.tiles.map((tile) => (
          <label key={tile.code} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={`${row.id}-choice`}
              value={tile.code}
              checked={tile.chosen}
              onChange={() => handlers.setOption(row.group.group, tile.code)}
              className="mt-1 size-5"
            />
            <span>
              <span className="font-medium text-ink">{tile.code}</span> <span className="text-muted">{tile.label}</span>
              {tile.extraCost === null ? null : <span className="text-muted"> · {tile.extraCost}</span>}
              {tile.lockNote === null ? null : <span className="block text-xs text-muted">{tile.lockNote}</span>}
            </span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (row.kind === "parameters") {
    return (
      <div className="flex flex-col gap-3">
        {row.sliders.map((slider) => (
          <label key={slider.key} className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{slider.rangeLabel}</span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              onChange={(event) => handlers.setParameter(slider.key, Number(event.target.value))}
              className="h-11 w-full"
              data-testid={`teamwear-parameter-${slider.key}`}
            />
            {slider.lockNote === null ? null : <span className="text-xs text-muted">{slider.lockNote}</span>}
          </label>
        ))}
      </div>
    );
  }
  if (row.kind === "elements") {
    return (
      <div className="flex flex-col gap-2">
        {row.slots.map((slot) => (
          <label key={slot.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={slot.filled}
              onChange={(event) => handlers.setElement(slot.id as ElementSlotId, event.target.checked)}
              className="size-5"
            />
            <span className="text-ink">{ELEMENT_SLOT_LABELS[slot.id as ElementSlotId]}</span>
          </label>
        ))}
        <p className="text-xs text-muted">{row.note}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={row.on} onChange={(event) => handlers.setNamesNumbers(event.target.checked)} className="size-5" data-testid="teamwear-names-numbers" />
        <span className="text-ink">Put player names and numbers on this kit</span>
      </label>
      <p className="text-xs text-muted">{row.note}</p>
    </div>
  );
}
