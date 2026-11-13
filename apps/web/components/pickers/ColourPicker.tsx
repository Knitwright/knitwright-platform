"use client";

import { Pipette, X } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { BrandTabColour } from "@/components/brand-studio/BrandTab";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { clampOpacity, cssColour, fromSquare, hexLabel, hexToHsv, hsvToHex, hueHex, nudge, parseHex, parseRgb, printWarning, rgbText, type Hsv, type PickedColour } from "@/lib/pickers";

/**
 * THE COLOUR PICKER (plan v6 E5, decision 0149; `08` §5.7 and v3.3 "Colour picker", prototype e33): a
 * 390 px panel with **Color | Brand** tabs and ✕; the saturation-value square, then eyedropper · hue
 * bar · alpha bar; HEX ▾ · value · %; and the Project colors row. **Brand** lists the brand kit's
 * palettes (`brandTabColours`, Brand Studio's own rows), each colour with the sublimation estimate's
 * answer already worked out. On a garment panel (`garmentPanel`) a print-safe warning line sits under
 * the HEX field, in the estimate's own words.
 *
 * Every control works from the keyboard: arrows move the square and the bars (Shift for ten), and the
 * HEX field takes a typed value. The eyedropper is the browser's own, offered only where it exists.
 * Exported for E3's inspectors: `onChange` gets `#rrggbb` and an opacity in per cent.
 */

export type ColourPickerProps = Readonly<{
  value: PickedColour;
  onChange: (next: PickedColour) => void;
  onClose?: () => void;
  /** The canvas's own colours, as hex. */
  projectColours: readonly string[];
  /** The brand kit's colours. Empty shows the Brand tab's empty state. */
  brand: readonly BrandTabColour[];
  /** True when the colour lands on a garment panel: adds the print warning. */
  garmentPanel?: boolean;
  /** The panel's name, for a screen reader. */
  label?: string;
}>;

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

const ID = "colour-picker";
const TABS = [
  { id: "color", label: "Color" },
  { id: "brand", label: "Brand" },
];

/** The browser's own eyedropper, where it has one; read after hydration, so the first paint matches the server. */
const readDropper = (): EyeDropperCtor | null => (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null;
const noSubscribe = (): (() => void) => () => undefined;

const HUE_STOPS = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map(hueHex).join(", ")})`;
const CHECKER = "repeating-conic-gradient(var(--color-border) 0% 25%, var(--color-bg) 0% 50%) 50% / 0.75rem 0.75rem";

export function ColourPicker({ value, onChange, onClose, projectColours, brand, garmentPanel = false, label = "Colour" }: ColourPickerProps) {
  const [tab, setTab] = useState<"color" | "brand">("color");
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value.hex));
  const [format, setFormat] = useState<"hex" | "rgb">("hex");
  const [typed, setTyped] = useState<string | null>(null);
  const dropper = useSyncExternalStore(noSubscribe, readDropper, () => null);
  // Keep the hue when the value is set from outside to the colour already shown; follow it otherwise.
  const [seen, setSeen] = useState(value.hex);
  if (seen !== value.hex) {
    setSeen(value.hex);
    if (hsvToHex(hsv) !== value.hex) setHsv(hexToHsv(value.hex));
  }

  const emitHsv = (next: Hsv) => {
    setHsv(next);
    setTyped(null);
    onChange({ hex: hsvToHex(next), opacity: value.opacity });
  };
  const emitHex = (hex: string) => {
    setHsv(hexToHsv(hex));
    setTyped(null);
    onChange({ hex, opacity: value.opacity });
  };
  const warning = garmentPanel ? printWarning(value.hex) : null;
  const shown = typed ?? (format === "hex" ? hexLabel(value.hex) : rgbText(value.hex));

  return (
    <section aria-label={label} className="flex w-97.5 max-w-full flex-col gap-4 rounded-2xl border border-border bg-bg p-5 text-text shadow-e3" data-testid="colour-picker">
      <div className="flex items-center justify-between border-b border-border">
        <Tabs items={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Colour source" idBase={ID} className="border-b-0" />
        {onClose ? (
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full live:hover:bg-soft">
            <Icon icon={X} size={20} />
          </button>
        ) : null}
      </div>
      <div {...tabPanelProps(ID, tab)} className="flex flex-col gap-4">
        {tab === "color" ? (
          <>
            <Square hsv={hsv} onChange={emitHsv} />
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Pick a colour from the screen" disabled={dropper === null} title={dropper === null ? "This browser has no eyedropper." : undefined} onClick={() => void new (dropper as EyeDropperCtor)().open().then((picked) => emitHex(parseHex(picked.sRGBHex) ?? value.hex)).catch(() => undefined)} className="grid size-9 place-items-center rounded-md text-text-2 live:hover:bg-soft disabled:opacity-40">
                <Icon icon={Pipette} size={20} />
              </button>
              <div className="flex flex-1 flex-col gap-2.5">
                <Bar label="Hue" value={hsv.h} max={360} step={1} background={HUE_STOPS} thumb={hueHex(hsv.h)} onChange={(h) => emitHsv({ ...hsv, h })} />
                <Bar label="Opacity" value={value.opacity} max={100} step={1} background={`linear-gradient(to right, transparent, ${value.hex}), ${CHECKER}`} thumb={cssColour(value)} onChange={(opacity) => onChange({ hex: value.hex, opacity: clampOpacity(opacity) })} />
              </div>
            </div>
            <div className="grid grid-cols-[6rem_1fr_6rem] gap-2">
              <select aria-label="Colour format" value={format} onChange={(event) => {
                  setFormat(event.target.value as typeof format);
                  setTyped(null);
                }} className="h-11 rounded-lg border border-border bg-bg px-3 text-body-lg">
                <option value="hex">HEX</option>
                <option value="rgb">RGB</option>
              </select>
              <input
                aria-label={format === "hex" ? "Hex value" : "RGB value"}
                value={shown}
                onChange={(event) => setTyped(event.target.value)}
                onBlur={() => {
                  const next = typed === null ? null : format === "hex" ? parseHex(typed) : parseRgb(typed);
                  if (next) emitHex(next);
                  else setTyped(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="h-11 min-w-0 rounded-lg border border-border px-3 font-mono text-body-lg uppercase"
                data-testid="colour-hex"
              />
              <label className="flex h-11 items-center rounded-lg border border-border px-3 text-body-lg">
                <span className="sr-only">Opacity per cent</span>
                <input inputMode="numeric" value={value.opacity} onChange={(event) => onChange({ hex: value.hex, opacity: clampOpacity(Number(event.target.value)) })} className="w-full min-w-0 bg-transparent outline-none" />
                <span aria-hidden="true">%</span>
              </label>
            </div>
            {warning ? (
              <p role="status" className="rounded-md bg-warn-soft px-3 py-2 text-small text-warn" data-testid="colour-print-warning">
                {warning}
              </p>
            ) : null}
            <Swatches title="Project colors" colours={projectColours.map((hex) => ({ key: hex, hex, name: hexLabel(hex) }))} picked={value.hex} onPick={emitHex} empty="This canvas has no colours yet." />
          </>
        ) : (
          <Swatches title="Brand colors" colours={brand.map((one) => ({ key: one.key, hex: one.hex, name: `${one.name} · ${one.paletteName}`, warning: garmentPanel ? one.warning : null }))} picked={value.hex} onPick={emitHex} empty="Your brand kit has no colours yet. Add a palette on the Brand page and it appears here." />
        )}
      </div>
    </section>
  );
}

/** The saturation-value square: a press or drag picks; arrows step. */
function Square({ hsv, onChange }: Readonly<{ hsv: Hsv; onChange: (next: Hsv) => void }>) {
  const area = useRef<HTMLDivElement>(null);
  const at = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    onChange(fromSquare(hsv.h, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Readonly<Record<string, Partial<Hsv>>> = {
      ArrowLeft: { s: nudge(hsv.s, -step, 0, 1) },
      ArrowRight: { s: nudge(hsv.s, step, 0, 1) },
      ArrowUp: { v: nudge(hsv.v, step, 0, 1) },
      ArrowDown: { v: nudge(hsv.v, -step, 0, 1) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange({ ...hsv, ...move });
  };
  return (
    <div
      ref={area}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      aria-valuenow={Math.round(hsv.s * 100)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        at(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) at(event);
      }}
      onKeyDown={onKey}
      className="relative h-62.5 cursor-crosshair touch-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
      style={{ backgroundColor: hueHex(hsv.h) }}
    >
      <div aria-hidden="true" className="absolute inset-0 rounded-lg bg-linear-to-r from-white to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 rounded-lg bg-linear-to-b from-transparent to-black" />
      <span aria-hidden="true" className="pointer-events-none absolute size-4 -translate-1/2 rounded-full border-2 border-bg shadow-e1" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
    </div>
  );
}

type BarProps = Readonly<{ label: string; value: number; max: number; step: number; background: string; thumb: string; onChange: (next: number) => void }>;

/** A hue or alpha bar: a native range input under a painted track, so the keyboard comes for free. */
function Bar({ label, value, max, step, background, thumb, onChange }: BarProps) {
  return (
    <span className="relative flex h-3.5 items-center">
      <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background }} />
      <input type="range" aria-label={label} min={0} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="peer relative h-3.5 w-full cursor-pointer appearance-none bg-transparent opacity-0" />
      <span aria-hidden="true" className="pointer-events-none absolute size-4 -translate-x-1/2 rounded-full border-2 border-bg shadow-e1 peer-focus-visible:ring-2 peer-focus-visible:ring-electric peer-focus-visible:ring-offset-1" style={{ left: `${(value / max) * 100}%`, background: thumb }} />
    </span>
  );
}

type Swatch = Readonly<{ key: string; hex: string; name: string; warning?: string | null }>;

function Swatches({ title, colours, picked, onPick, empty }: Readonly<{ title: string; colours: readonly Swatch[]; picked: string; onPick: (hex: string) => void; empty: string }>) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-body-lg font-medium text-muted">{title}</h3>
      {colours.length === 0 ? (
        <p className="text-body text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2.5">
          {colours.map((one) => (
            <li key={one.key}>
              <button
                type="button"
                aria-label={`${one.name}${one.warning ? ` (${one.warning})` : ""}`}
                aria-pressed={one.hex.toLowerCase() === picked.toLowerCase()}
                title={one.warning ?? one.name}
                onClick={() => onPick(one.hex.toLowerCase())}
                className={cx("relative size-8 rounded-full border border-border-strong", one.hex.toLowerCase() === picked.toLowerCase() && "ring-2 ring-electric ring-offset-2")}
                style={{ backgroundColor: one.hex }}
              >
                {one.warning ? <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border border-bg bg-warn" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
