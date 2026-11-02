"use client";

import { asPercent, colourFor, elementById, elementTransform, type MarketingBoardSettings, type MarketingSlot } from "@/lib/marketing";

/**
 * A SMALL PICTURE OF THE LAYOUT (plan v5 L4, decision 0094).
 *
 * The shell draws the canvas; this is the panel's own thumbnail of the artboard it is editing, so a
 * person can see which slot they are filling. It is the same geometry as the export -- fractions of
 * the artboard, from `asPercent` -- so what the panel shows and what the file holds cannot drift.
 *
 * It draws no garment: a mockup slot is shown as a frame with its label, exactly as the export does
 * when it has no picture.
 */

type Props = Readonly<{
  slots: readonly MarketingSlot[];
  settings: MarketingBoardSettings;
  /** The width and height of the artboard, so the thumbnail keeps its shape. */
  size: Readonly<{ width: number; height: number }>;
  /** The slot being edited, which is marked. */
  highlight?: string | null;
}>;

/** The colours a layout falls back to when the brand has none on file. Greys, so nothing is invented. */
const FALLBACK: Readonly<Record<string, string>> = {
  background: "#1b1d22",
  primary: "#f4f5f7",
  secondary: "#c9ccd4",
  accent: "#9aa0a6",
  trim: "#6f747d",
};

export function ArtboardPreview({ slots, settings, size, highlight = null }: Props) {
  const ratio = `${size.width} / ${size.height}`;
  return (
    <div
      data-testid="marketing-preview"
      role="img"
      aria-label={`The artboard, ${slots.length} layers`}
      className="relative w-full overflow-hidden rounded-2xl border border-white/15"
      style={{ aspectRatio: ratio, backgroundColor: settings.colours.background ?? FALLBACK.background }}
    >
      {slots.map((slot) => (
        <Slot key={slot.id} slot={slot} settings={settings} highlighted={slot.id === highlight} />
      ))}
    </div>
  );
}

function Slot({ slot, settings, highlighted }: Readonly<{ slot: MarketingSlot; settings: MarketingBoardSettings; highlighted: boolean }>) {
  const colour = colourFor(slot, settings.colours, FALLBACK) ?? FALLBACK.primary;
  const place = asPercent(slot.rect);
  const words = settings.words[slot.id];
  const element = settings.fills[slot.id] ? elementById(settings.fills[slot.id]!) : null;
  const ring = highlighted ? "outline-2 outline-offset-1 outline-cobalt-soft" : "";

  if (slot.kind === "shape") {
    return (
      <span aria-hidden="true" className={`absolute ${ring}`} style={{ ...place, backgroundColor: colour, opacity: 0.9 }}>
        {element ? (
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="size-full">
            <path d={element.path} transform={elementTransform({ x: 0, y: 0, width: 1, height: 1 })} fill={colour} opacity={0.55} />
          </svg>
        ) : null}
      </span>
    );
  }

  if (slot.kind === "text" || slot.kind === "qr") {
    return (
      <span
        className={`absolute flex items-center overflow-hidden text-[8px] leading-tight ${ring}`}
        style={{ ...place, color: colour }}
        title={slot.label}
      >
        <span className="truncate">{words ?? slot.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`absolute flex items-center justify-center rounded-sm border border-dashed border-white/40 text-[8px] text-white/70 ${ring}`}
      style={place}
      title={slot.label}
    >
      {settings.pictures[slot.id] ? slot.label : `${slot.label} — empty`}
    </span>
  );
}
