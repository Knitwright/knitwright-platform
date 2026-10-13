import { z } from "zod";
import {
  KIT_PATTERN_LABELS,
  KIT_PATTERN_STYLES,
  MAX_PATTERN_COLOURS,
  SWATCH_PATTERN,
  patternColourText,
  type GarmentSpec,
  type PatternColour,
  type SpecAction,
} from "@/lib/garment";

/**
 * The assistant's side of kit patterns (owner decision 2026-10-13): "add hoops", "navy and
 * gold stripes", "make it plain". A model names the style and, when the person said them, the
 * colours of the pattern; the body colour stays a `set-colour`. A size is never set by a model.
 */

const COLOUR_TEXT_MAX = 60;

const wireColour = z.strictObject({
  colour: z.string().max(COLOUR_TEXT_MAX),
  swatch: z.string().regex(SWATCH_PATTERN).optional(),
});

export const setKitPatternWire = z.strictObject({
  type: z.literal("set-kit-pattern"),
  style: z.enum(KIT_PATTERN_STYLES),
  /** The colours printed over the body, main first. Left out when the person named none. */
  colours: z.array(wireColour).min(1).max(MAX_PATTERN_COLOURS).optional(),
});

export const removeKitPatternWire = z.strictObject({ type: z.literal("remove-kit-pattern") });

export type SetKitPatternWire = z.output<typeof setKitPatternWire>;

/** The lines that tell a model about kit patterns. */
export const KIT_PATTERN_PROMPT = `{"type": "set-kit-pattern", "style": "${KIT_PATTERN_STYLES.join('" | "')}", "colours": [{"colour": "gold", "swatch": "#d4af37"}]}  a pattern printed over the body (tops only); colours are the pattern's, one or two, swatch optional; leave colours out if the customer named none; set the body colour with set-colour
{"type": "remove-kit-pattern"}  makes the kit plain`;

export const NO_PATTERN_COLOUR = "Say which colour the pattern should be.";

/** The trim colour a pattern can fall back on: the collar, neckband or cuffs of the first colourway. */
function trimColour(spec: GarmentSpec): PatternColour | null {
  const found = ["collar", "neckband", "cuffs"]
    .map((panelId) => spec.colourways[0].colours.find((entry) => entry.panelId === panelId))
    .find((entry) => entry !== undefined);
  return found ? { colour: found.colour, ...(found.swatch === undefined ? {} : { swatch: found.swatch }) } : null;
}

type Converted = { readonly ok: true; readonly action: SpecAction } | { readonly ok: false; readonly reason: string };

/**
 * A model's pattern as the editor's change, marked with the model's source. Colours left out keep
 * the pattern's own, or else take the trim colour; with neither, the person is asked for one.
 */
export function kitPatternAction(spec: GarmentSpec, wire: SetKitPatternWire, source: "ai-suggested" | "read-from-image"): Converted {
  const named = wire.colours?.map((entry) => ({ colour: entry.colour.trim(), ...(entry.swatch === undefined ? {} : { swatch: entry.swatch }) }));
  const trim = trimColour(spec);
  const colours = named ?? spec.kitPattern?.colours ?? (trim ? [trim] : null);
  if (!colours || colours.length === 0) return { ok: false, reason: NO_PATTERN_COLOUR };
  const kept = spec.kitPattern?.style === wire.style ? spec.kitPattern : undefined;
  return {
    ok: true,
    action: {
      type: "set-kit-pattern",
      kitPattern: {
        style: wire.style,
        colours,
        ...(kept?.size === undefined ? {} : { size: kept.size }),
        ...(kept?.technique === undefined ? {} : { technique: kept.technique }),
        provenance: source,
      },
    },
  };
}

/** One sentence for a change of kit pattern, or none when it did not change. */
export function explainKitPattern(before: GarmentSpec, after: GarmentSpec): string[] {
  const was = before.kitPattern;
  const now = after.kitPattern;
  if (JSON.stringify(was) === JSON.stringify(now)) return [];
  if (!now) return ["Kit pattern removed. The kit is plain."];
  const colours = now.colours.map(patternColourText).join(" and ");
  return [`Kit pattern ${was ? "changed to" : "set to"} ${KIT_PATTERN_LABELS[now.style]} in ${colours}.`];
}
