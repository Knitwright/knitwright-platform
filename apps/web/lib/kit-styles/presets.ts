import {
  applyAction,
  getType,
  KIT_PATTERN_LABELS,
  panelsFor,
  SWATCH_PATTERN,
  type Colourway,
  type GarmentSpec,
  type KitPatternStyle,
  type SpecAction,
} from "@/lib/garment";

/**
 * Kit styles (owner decision 2026-10-13): starting points a club picks from at the start of a
 * design. A style is a set of changes to the design, not a picture: it colours the body,
 * sleeves and trims in the club's colours and sets the kit pattern, so the flats, the tech pack
 * and every export show it. Picked colours are screen colours only; the colour references a
 * factory matches are still the brand's to give.
 */

export type KitStyleId = "plain" | KitPatternStyle;

interface KitStyle {
  readonly id: KitStyleId;
  readonly label: string;
  /** One short line under the tile. */
  readonly hint: string;
  /** The band size the style starts with, in tenths of a millimetre. None for plain, fade and polka dots, whose sizes nobody has given yet. */
  readonly size?: number;
}

const STYLES: readonly KitStyle[] = [
  { id: "plain", label: "Plain", hint: "One colour body, trims in the second colour." },
  { id: "hoops", label: KIT_PATTERN_LABELS.hoops, hint: "Bands around the body.", size: 900 },
  { id: "stripes", label: KIT_PATTERN_LABELS.stripes, hint: "Wide stripes from shoulder to hem.", size: 700 },
  { id: "pinstripes", label: KIT_PATTERN_LABELS.pinstripes, hint: "Fine lines, close together.", size: 320 },
  { id: "sash", label: KIT_PATTERN_LABELS.sash, hint: "A band from shoulder to hip.", size: 1100 },
  { id: "side-panels", label: KIT_PATTERN_LABELS["side-panels"], hint: "A panel down each side.", size: 800 },
  { id: "chest-band", label: KIT_PATTERN_LABELS["chest-band"], hint: "One band across the chest.", size: 900 },
  { id: "dots", label: KIT_PATTERN_LABELS.dots, hint: "Round dots in rows, in one or two colours." },
  { id: "fade", label: KIT_PATTERN_LABELS.fade, hint: "A printed fade into the second colour." },
];

/** The styles each garment offers. A garment not listed has no kit styles. */
const OFFERED: Readonly<Record<string, readonly KitStyleId[]>> = {
  "team-jersey": ["plain", "hoops", "stripes", "pinstripes", "sash", "side-panels", "chest-band", "fade", "dots"],
  polo: ["plain", "hoops", "stripes", "pinstripes", "side-panels", "chest-band", "fade"],
  "crew-tee": ["plain", "hoops", "stripes", "side-panels", "chest-band", "fade"],
  "v-neck-tee": ["plain", "hoops", "stripes", "side-panels", "chest-band", "fade"],
  "long-sleeve-tee": ["plain", "hoops", "stripes", "side-panels", "chest-band", "fade"],
};

export const styleOf = (id: string): KitStyle | undefined => STYLES.find((style) => style.id === id);

export const kitStylesFor = (typeId: string): readonly KitStyle[] =>
  (OFFERED[typeId] ?? []).map((id) => styleOf(id)).filter((style): style is KitStyle => style !== undefined);

/** The club's colours as screen colours: the main one for the body, a second for trims and pattern, and an optional third. */
export interface ClubColours {
  readonly main: string;
  readonly second: string;
  readonly third: string | null;
}

/** Common club colours to pick from. The names are for the screen only. */
export const CLUB_PALETTE: readonly { readonly name: string; readonly swatch: string }[] = [
  { name: "Navy", swatch: "#1b2a49" },
  { name: "Royal blue", swatch: "#1f4fbf" },
  { name: "Sky blue", swatch: "#6cabdd" },
  { name: "Red", swatch: "#c8102e" },
  { name: "Maroon", swatch: "#7a1f2b" },
  { name: "Green", swatch: "#00843d" },
  { name: "Bottle green", swatch: "#0b3d2e" },
  { name: "Gold", swatch: "#d4af37" },
  { name: "Yellow", swatch: "#f6d330" },
  { name: "Orange", swatch: "#e86a10" },
  { name: "Purple", swatch: "#5b2c83" },
  { name: "Black", swatch: "#111111" },
  { name: "White", swatch: "#ffffff" },
  { name: "Grey", swatch: "#8a8d91" },
];

/** Used when the design has no colours of its own yet. There are no brand colours to start from. */
export const DEFAULT_CLUB_COLOURS: ClubColours = { main: "#1b2a49", second: "#d4af37", third: null };

const BODY_PANELS = ["body-front", "body-back", "sleeve-left", "sleeve-right"] as const;
/** Parts that take the second colour: trims, a collar and a sewn side panel. */
const TRIM_PANELS = ["neckband", "collar", "cuffs", "side-panels"] as const;

const swatchIn = (colourway: Colourway, panelId: string): string | undefined =>
  colourway.colours.find((entry) => entry.panelId === panelId)?.swatch;

/** The colours a design already has: its body, its trim and its pattern. A default fills any gap. */
export function clubColoursFrom(spec: GarmentSpec): ClubColours {
  const colourway = spec.colourways[0];
  const trim = TRIM_PANELS.map((id) => swatchIn(colourway, id)).find((swatch) => swatch !== undefined);
  const pattern = spec.kitPattern?.colours.map((entry) => entry.swatch);
  return {
    main: swatchIn(colourway, "body-front") ?? DEFAULT_CLUB_COLOURS.main,
    second: pattern?.[0] ?? trim ?? DEFAULT_CLUB_COLOURS.second,
    third: pattern?.[1] ?? DEFAULT_CLUB_COLOURS.third,
  };
}

/** A colour from an address, such as `1b2a49` or `#1B2A49`, or null when it is not one. */
function swatchFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = (value.startsWith("#") ? value : `#${value}`).toLowerCase();
  return SWATCH_PATTERN.test(candidate) ? candidate : null;
}

/** Club colours from the address of the gallery. `none` clears the third; anything else unreadable keeps the fallback. */
export function readClubColours(query: Readonly<Record<string, unknown>>, fallback: ClubColours): ClubColours {
  return {
    main: swatchFrom(query.main) ?? fallback.main,
    second: swatchFrom(query.second) ?? fallback.second,
    third: query.third === "none" ? null : (swatchFrom(query.third) ?? fallback.third),
  };
}

type StyleActions = { readonly ok: true; readonly actions: readonly SpecAction[] } | { readonly ok: false; readonly reason: string };

function colourwayWith(spec: GarmentSpec, colourway: Colourway, colours: ClubColours): Colourway {
  const present = new Set(panelsFor(spec).map((panel) => panel.id));
  const wanted = new Map<string, string>([
    ...BODY_PANELS.map((id) => [id, colours.main] as const),
    ...TRIM_PANELS.map((id) => [id, colours.second] as const),
  ]);
  const set = [...wanted].filter(([id]) => present.has(id));
  const kept = colourway.colours.filter((entry) => !wanted.has(entry.panelId));
  return {
    ...colourway,
    colours: [...kept, ...set.map(([panelId, swatch]) => ({ panelId, colour: "", swatch, provenance: "user-edited" as const }))],
  };
}

/**
 * The changes that put a kit style on a design, in the club's colours: the colourway (the first,
 * or the one named), then the pattern, or no pattern for a plain kit. They are applied together
 * as one version. Every value is marked as the person's own choice.
 */
export function kitStyleActions(spec: GarmentSpec, styleId: string, colours: ClubColours, colourwayId?: string): StyleActions {
  const type = getType(spec.typeId);
  const style = kitStylesFor(spec.typeId).find((entry) => entry.id === styleId);
  if (!type || !style) return { ok: false, reason: `${type?.label ?? "This garment"} does not come in that kit style.` };
  const colourway = colourwayId === undefined ? spec.colourways[0] : spec.colourways.find((entry) => entry.id === colourwayId);
  if (!colourway) return { ok: false, reason: "That colourway is not on this design." };
  const recolour: SpecAction = { type: "update-colourway", colourway: colourwayWith(spec, colourway, colours) };
  if (style.id === "plain") {
    return { ok: true, actions: spec.kitPattern ? [recolour, { type: "remove-kit-pattern" }] : [recolour] };
  }
  const printed = [colours.second, ...(colours.third ? [colours.third] : [])].map((swatch) => ({ colour: "", swatch }));
  const pattern: SpecAction = {
    type: "set-kit-pattern",
    kitPattern: {
      style: style.id,
      colours: printed,
      ...(style.size === undefined ? {} : { size: style.size }),
      ...(style.id === "fade" ? { technique: "sublimation" as const } : {}),
      provenance: "user-edited",
    },
  };
  return { ok: true, actions: [recolour, pattern] };
}

/** The design with a kit style on it, or the reason it cannot have one. Used for the gallery's pictures and in tests. */
export function withKitStyle(
  spec: GarmentSpec,
  styleId: string,
  colours: ClubColours,
): { readonly ok: true; readonly spec: GarmentSpec } | { readonly ok: false; readonly reason: string } {
  const planned = kitStyleActions(spec, styleId, colours);
  if (!planned.ok) return planned;
  let current = spec;
  for (const action of planned.actions) {
    const outcome = applyAction(current, action);
    if (!outcome.ok) return outcome;
    current = outcome.spec;
  }
  return { ok: true, spec: current };
}

/** The sentence for the design's history. */
export function kitStyleSentence(styleId: KitStyleId, colours: ClubColours): string {
  return `Kit style ${styleOf(styleId)?.label ?? styleId}, with a main colour and ${colours.third ? "two more" : "one more"}.`;
}
