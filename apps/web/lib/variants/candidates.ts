import { applyAction, type Artwork, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { clubColoursFrom, kitStyleActions, kitStylesFor, type ClubColours } from "@/lib/kit-styles/presets";
import { hexFromLch, lchOf, shiftHue } from "./lab";
import type { VariantKind } from "./types";

/** A change to try, before it is checked. */
export interface Candidate {
  readonly kind: VariantKind;
  readonly label: string;
  readonly summary: string;
  readonly actions: readonly SpecAction[];
}

/**
 * The named zones artwork may be moved between, by panel. They are the anchors the flat drawing knows
 * (lib/flat/templates/anchors.ts); the sleeve has one, so nothing moves there.
 */
export const ZONES: Readonly<Record<string, readonly { readonly anchor: string; readonly label: string }[]>> = {
  "body-front": [
    { anchor: "centre-chest", label: "centre of the chest" },
    { anchor: "left-chest", label: "left chest" },
    { anchor: "right-chest", label: "right chest" },
    { anchor: "lower-front", label: "lower front" },
  ],
  "body-back": [
    { anchor: "upper-back", label: "upper back" },
    { anchor: "centre-back", label: "centre of the back" },
    { anchor: "lower-back", label: "lower back" },
  ],
};

const zoneLabel = (panelId: string, anchor: string): string => ZONES[panelId]?.find((zone) => zone.anchor === anchor)?.label ?? anchor;

/** Applies actions in order. Null when any is refused. */
export function applyAll(spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec | null {
  let current = spec;
  for (const action of actions) {
    const outcome = applyAction(current, action);
    if (!outcome.ok) return null;
    current = outcome.spec;
  }
  return current;
}

const styleOf = (spec: GarmentSpec): string => spec.kitPattern?.style ?? "plain";

/** The recolour of a kit style plan, with the pattern kept as the design has it (its size and technique) and only its colours changed. */
function recolourActions(spec: GarmentSpec, colours: ClubColours): readonly SpecAction[] | null {
  const planned = kitStyleActions(spec, styleOf(spec), colours);
  if (!planned.ok) return null;
  const [recolour, pattern] = planned.actions;
  if (!spec.kitPattern || pattern?.type !== "set-kit-pattern") return [recolour];
  const printed = [colours.second, ...(spec.kitPattern.colours.length > 1 && colours.third ? [colours.third] : [])].map((swatch) => ({ colour: "", swatch }));
  return [recolour, { type: "set-kit-pattern", kitPattern: { ...spec.kitPattern, colours: printed, provenance: "user-edited" } }];
}

const HARMONY_SHIFTS: readonly (readonly [number, string])[] = [
  [30, "a warmer neighbour"],
  [-30, "a cooler neighbour"],
  [120, "a triad"],
  [-120, "the other triad"],
  [180, "the complement"],
  [150, "a split complement"],
  [-150, "the other split complement"],
];

/** A contrasting trim for a main colour: dark on a light body, light on a dark one, with a trace of the main hue. */
function contrastTrim(main: string): string {
  const [l, , h] = lchOf(main);
  return hexFromLch(l > 55 ? 20 : 92, 10, h);
}

/** Colourways: the club's own colours swapped about, then Lab palettes turned from the main hue. The swap comes first. */
export function colourwayCandidates(spec: GarmentSpec): readonly Candidate[] {
  const club = clubColoursFrom(spec);
  const options: { colours: ClubColours; label: string; summary: string }[] = [
    { colours: { main: club.second, second: club.main, third: club.third }, label: "Colours swapped", summary: "The main and second colours change places." },
  ];
  if (club.third) {
    options.push(
      { colours: { main: club.second, second: club.third, third: club.main }, label: "Colours turned round", summary: "The second colour leads, then the third, then the main." },
      { colours: { main: club.third, second: club.main, third: club.second }, label: "Third colour leads", summary: "The third colour becomes the main colour." },
    );
  }
  for (const [degrees, name] of HARMONY_SHIFTS) {
    options.push({
      colours: { main: shiftHue(club.main, degrees), second: shiftHue(club.second, degrees), third: club.third ? shiftHue(club.third, degrees) : null },
      label: `Palette: ${name}`,
      summary: `Every colour turned ${Math.abs(degrees)} degrees round the colour wheel, same lightness.`,
    });
  }
  const trim = contrastTrim(club.main);
  options.push({
    colours: { main: club.main, second: trim, third: club.third },
    label: "Contrast trim",
    summary: "The main colour stays; the second colour becomes a light or dark partner for it.",
  });
  return options.flatMap((option): Candidate[] => {
    const actions = recolourActions(spec, option.colours);
    return actions ? [{ kind: "colourway", label: option.label, summary: option.summary, actions }] : [];
  });
}

/** Every other kit style the garment offers, in the club's present colours. */
export function kitStyleCandidates(spec: GarmentSpec): readonly Candidate[] {
  const club = clubColoursFrom(spec);
  return kitStylesFor(spec.typeId)
    .filter((style) => style.id !== styleOf(spec))
    .flatMap((style): Candidate[] => {
      const planned = kitStyleActions(spec, style.id, club);
      return planned.ok ? [{ kind: "kit-style", label: `Kit style: ${style.label}`, summary: style.hint, actions: planned.actions }] : [];
    });
}

const moved = (item: Artwork, anchor: string): SpecAction => ({
  type: "update-artwork",
  artwork: { ...item, anchor, offsetX: 0, offsetY: 0, provenance: "user-edited" },
});

/** Moves of artwork between the named zones of its panel, never onto a zone another item holds, and swaps of two items. */
export function placementCandidates(spec: GarmentSpec): readonly Candidate[] {
  const out: Candidate[] = [];
  for (const item of spec.artwork) {
    const taken = new Set(spec.artwork.filter((other) => other.id !== item.id && other.panelId === item.panelId).map((other) => other.anchor));
    for (const zone of ZONES[item.panelId] ?? []) {
      if (zone.anchor === item.anchor && item.offsetX === 0 && item.offsetY === 0) continue;
      if (taken.has(zone.anchor)) continue;
      out.push({
        kind: "placement",
        label: `${item.name}: ${zone.label}`,
        summary: `${item.name} moves from the ${zoneLabel(item.panelId, item.anchor)} to the ${zone.label}. Its size stays.`,
        actions: [moved(item, zone.anchor)],
      });
    }
  }
  for (const [i, a] of spec.artwork.entries()) {
    for (const b of spec.artwork.slice(i + 1)) {
      if (a.panelId !== b.panelId || a.anchor === b.anchor || !ZONES[a.panelId]) continue;
      out.push({
        kind: "placement",
        label: `Swap ${a.name} and ${b.name}`,
        summary: `${a.name} and ${b.name} change places. Their sizes stay.`,
        actions: [moved(a, b.anchor), moved(b, a.anchor)],
      });
    }
  }
  return out;
}
