import { z } from "zod";
import { COLOUR_MAX_LENGTH, SWATCH_PATTERN, TECHNIQUES } from "./parts";
import { freeText } from "./primitives";
import { provenanceSchema } from "./provenance";
import { getType } from "./registry";
import { formatCm, MEASUREMENT_MAX_TENTHS_MM } from "./units";

/**
 * A kit pattern (owner decision 2026-10-13): a style printed over the body of a top, such as
 * hoops or a sash, in one or two colours. The body colour of each colourway is the ground the
 * pattern is printed on, so a colourway still changes the look. The pattern is part of the
 * design: it is drawn on the flats, described in the tech pack and written into every export.
 * A plain kit has no pattern at all.
 */

export const KIT_PATTERN_STYLES = ["hoops", "stripes", "pinstripes", "sash", "side-panels", "chest-band", "fade", "dots"] as const;
export type KitPatternStyle = (typeof KIT_PATTERN_STYLES)[number];

export const KIT_PATTERN_LABELS: Readonly<Record<KitPatternStyle, string>> = {
  hoops: "Hoops",
  stripes: "Vertical stripes",
  pinstripes: "Pinstripes",
  sash: "Sash",
  "side-panels": "Side panels",
  "chest-band": "Chest band",
  fade: "Fade",
  dots: "Polka dots",
};

/** The families whose drawings can carry a kit pattern. */
const PATTERN_FAMILIES: readonly string[] = ["tops"];

/** The most colours a pattern prints over the ground. */
export const MAX_PATTERN_COLOURS = 2;

const patternColourSchema = z
  .object({
    /** Free text, such as a Pantone name. May be empty when a swatch is set. */
    colour: freeText(COLOUR_MAX_LENGTH),
    swatch: z.string().regex(SWATCH_PATTERN, "Use a colour like #1b2a49.").optional(),
  })
  .readonly()
  .refine((entry) => entry.colour !== "" || entry.swatch !== undefined, { message: "Enter a colour.", path: ["colour"] });
export type PatternColour = z.output<typeof patternColourSchema>;

/**
 * How polka dots are laid out, in tenths of a millimetre. The dot's width is the pattern's `size`.
 * Anything left out is drawn with a stand-in on the flats and written as "to be confirmed".
 */
const dotsSchema = z
  .object({
    /** Centre to centre along a row. */
    pitch: z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM).optional(),
    /** Distance from one row to the next. */
    rowStep: z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM).optional(),
    /** Every other row shifted along by half a pitch. */
    halfDrop: z.boolean().optional(),
    /** Dots stay this far from a name, number, crest or sponsor mark. */
    clearSpace: z.number().int().min(0).max(MEASUREMENT_MAX_TENTHS_MM).optional(),
  })
  .readonly();
export type DotsLayout = z.output<typeof dotsSchema>;

export const kitPatternSchema = z
  .object({
    style: z.enum(KIT_PATTERN_STYLES),
    /** The colours printed over the body colour, main first. */
    colours: z.array(patternColourSchema).min(1, "Choose a colour for the pattern.").max(MAX_PATTERN_COLOURS).readonly(),
    /** The width of a band or stripe, in tenths of a millimetre. Left out until someone gives one. */
    size: z.number().int().min(1).max(MEASUREMENT_MAX_TENTHS_MM).optional(),
    /** Only for polka dots: the spacing. Row A takes the first colour and row B the second. */
    dots: dotsSchema.optional(),
    technique: z.enum(TECHNIQUES).optional(),
    provenance: provenanceSchema,
  })
  .readonly()
  .refine((pattern) => pattern.dots === undefined || pattern.style === "dots", { message: "Dot spacing only goes with polka dots.", path: ["dots"] })
  .refine((pattern) => pattern.size === undefined || pattern.dots?.pitch === undefined || pattern.dots.pitch >= pattern.size, {
    message: "Dots cannot be wider than the space between them.",
    path: ["dots", "pitch"],
  });
export type KitPattern = z.output<typeof kitPatternSchema>;

/** True when a garment of this type can carry a kit pattern. */
export function kitPatternFits(typeId: string): boolean {
  const type = getType(typeId);
  return type !== undefined && PATTERN_FAMILIES.includes(type.family);
}

/** Says why this garment cannot carry a kit pattern, or null when it can. */
export function kitPatternProblem(typeId: string): string | null {
  return kitPatternFits(typeId) ? null : `Kit patterns are drawn on tops only, and ${getType(typeId)?.label ?? typeId} is not a top.`;
}

/** A copy of a design without a kit pattern: the key is left out, as on a design that never had one. */
export function withoutKitPattern<T extends { readonly kitPattern?: unknown }>(spec: T): Omit<T, "kitPattern"> {
  return Object.fromEntries(Object.entries(spec).filter(([key]) => key !== "kitPattern")) as Omit<T, "kitPattern">;
}

/** A colour as a factory reads it: the name and the screen colour, or whichever is given. */
export function patternColourText(entry: PatternColour): string {
  if (entry.colour === "") return `screen colour ${entry.swatch ?? ""}`;
  return entry.swatch === undefined ? entry.colour : `${entry.colour} (${entry.swatch})`;
}

const SIZE_WORDS: Readonly<Record<KitPatternStyle, string>> = {
  hoops: "bands",
  stripes: "stripes",
  pinstripes: "spaced",
  sash: "sash",
  "side-panels": "panels",
  "chest-band": "band",
  fade: "fade",
  dots: "dots",
};

const cm = (tenths: number | undefined, what: string): string => (tenths === undefined ? `${what} to be confirmed` : `${what} ${formatCm(tenths)} cm`);

/** The spacing of polka dots in plain words; a number nobody gave is "to be confirmed". */
function dotsDetail(pattern: KitPattern): string {
  const layout = pattern.dots;
  const parts = [
    cm(pattern.size, "dots"),
    cm(layout?.pitch, "centres"),
    cm(layout?.rowStep, "rows"),
    layout?.halfDrop === false ? "rows line up" : "every other row shifted half a step",
    ...(pattern.colours.length > 1 ? ["colour changes row by row"] : []),
    ...(layout?.clearSpace === undefined ? [] : [`${formatCm(layout.clearSpace)} cm clear around names, numbers and marks`]),
  ];
  return `, ${parts.join(", ")}`;
}

/** One sentence a factory can print from: the style, the colours, the size when given, and where it goes. */
export function describeKitPattern(pattern: KitPattern): string {
  const colours = pattern.colours.map(patternColourText).join(" and ");
  const label = KIT_PATTERN_LABELS[pattern.style];
  const head =
    pattern.style === "fade"
      ? `${label}, a printed gradient from the body colour into ${colours}`
      : `${label} in ${colours} over the body colour`;
  if (pattern.style === "dots") return `${head}${dotsDetail(pattern)}, on the front and back of the body.`;
  const size = pattern.size === undefined || pattern.style === "fade" ? "" : `, ${SIZE_WORDS[pattern.style]} ${formatCm(pattern.size)} cm`;
  return `${head}${size}, on the front and back of the body.`;
}
