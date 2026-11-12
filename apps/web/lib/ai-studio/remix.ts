import type { GarmentSpec } from "@/lib/garment";
import { clubColoursFrom, kitStyleActions, kitStylesFor, type ClubColours } from "@/lib/kit-styles/presets";
import { sameDesign } from "@/lib/projects/same-design";
import { applyAll, type Candidate } from "@/lib/variants/candidates";
import { guardrailFindings, structureKept } from "@/lib/variants/generate";
import { hexFromLch, lchOf } from "@/lib/variants/lab";
import { shortHash } from "@/lib/variants/random";
import type { Variant, VariantFinding, VariantGate } from "@/lib/variants/types";
import { ERA_LABELS, type Era } from "./eras";

export { ERAS, ERA_LABELS, isEra, type Era } from "./eras";

/**
 * RETRO KIT REMIX AND CHANGE KIT COLOUR (decision 0141): variants of a design from its own
 * parameters, never pixels on a panel (spec decision 13).
 *
 * A remix is a set of ordinary design changes -- the colourway and the kit pattern, through the same
 * `kitStyleActions` the kit styles use -- so the flats, the tech pack and every export show it, and
 * the pattern can only be one the garment's base offers. Each candidate then passes the gate
 * `lib/variants` uses for the editor's alternatives: the structure is kept, it is not a repeat, and
 * it brings no blocker the design did not already have. A candidate that fails is dropped, so fewer
 * than four can come back, and the page says why when none does.
 */


/**
 * How an era moves a colour, in LCH: lightness added, chroma multiplied, hue turned. A Knitwright
 * reading of each decade's printed kits, labelled as ours (owner question, 0141), not a fact.
 */
const ERA_SHIFTS: Readonly<Record<Era, Readonly<{ light: number; chroma: number; hue: number; lead: string }>>> = {
  "70s": { light: 4, chroma: 0.7, hue: 12, lead: "Warm, washed colours." },
  "80s": { light: 0, chroma: 1.3, hue: 0, lead: "Saturated colours, high contrast." },
  "90s": { light: -2, chroma: 1.15, hue: -8, lead: "Bold, deep colours." },
  "00s": { light: -4, chroma: 0.9, hue: -15, lead: "Cool, technical colours." },
};

export const REMIX_COUNT = 4;

/** The pattern families a design's garment offers, plus keeping the one it has. */
export const patternFamiliesFor = (typeId: string): readonly Readonly<{ id: string; label: string }>[] =>
  kitStylesFor(typeId).map((style) => ({ id: style.id, label: style.label }));

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** One colour moved as an era moves it. */
export function eraColour(hex: string, era: Era): string {
  const [l, c, h] = lchOf(hex);
  const shift = ERA_SHIFTS[era];
  return hexFromLch(clamp(l + shift.light, 4, 96), clamp(c * shift.chroma, 0, 120), (h + shift.hue + 360) % 360);
}

const eraPalette = (colours: ClubColours, era: Era): ClubColours => ({
  main: eraColour(colours.main, era),
  second: eraColour(colours.second, era),
  third: colours.third === null ? null : eraColour(colours.third, era),
});

/** A light or dark partner for a main colour, with a trace of its hue. */
const contrastPartner = (main: string): string => {
  const [l, , h] = lchOf(main);
  return hexFromLch(l > 55 ? 18 : 94, 8, h);
};

type Option = Readonly<{ colours: ClubColours; label: string; summary: string }>;

/** The four colour arrangements every remix and recolour tries, in order. */
function arrangements(colours: ClubColours, name: string): readonly Option[] {
  return [
    { colours, label: name, summary: "Main colour on the body, second on the trims and the pattern." },
    { colours: { ...colours, main: colours.second, second: colours.main }, label: `${name}, reversed`, summary: "The main and second colours change places." },
    { colours: { ...colours, second: contrastPartner(colours.main) }, label: `${name}, contrast trim`, summary: "The main colour with a light or dark partner on the trims." },
    {
      colours: { main: colours.third ?? contrastPartner(colours.second), second: colours.main, third: colours.second },
      label: `${name}, change strip`,
      summary: "A third colour leads, for a change or goalkeeper kit.",
    },
  ];
}

const candidatesOf = (spec: GarmentSpec, styleId: string, options: readonly Option[]): readonly Candidate[] =>
  options.flatMap((option): Candidate[] => {
    const planned = kitStyleActions(spec, styleId, option.colours);
    return planned.ok ? [{ kind: "kit-style", label: option.label, summary: option.summary, actions: planned.actions }] : [];
  });

const keyOf = (finding: VariantFinding): string => `${finding.code}|${finding.panel ?? ""}`;
const findingsOf = (spec: GarmentSpec, gate: VariantGate | undefined): readonly VariantFinding[] => [...guardrailFindings(spec), ...(gate?.(spec) ?? [])];

/**
 * The candidates that pass, as variants, up to `want`. The same checks as the editor's
 * alternatives (`lib/variants/generate.ts`): structure kept, no repeat, no new blocker.
 */
export function validVariants(spec: GarmentSpec, candidates: readonly Candidate[], gate?: VariantGate, want = REMIX_COUNT): readonly Variant[] {
  const known = new Set(findingsOf(spec, gate).filter((f) => f.severity === "blocker").map(keyOf));
  const seen: GarmentSpec[] = [spec];
  const chosen: Variant[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= want) break;
    const next = applyAll(spec, candidate.actions);
    if (!next || !structureKept(spec, next) || seen.some((other) => sameDesign(other, next))) continue;
    const findings = findingsOf(next, gate);
    if (findings.some((f) => f.severity === "blocker" && !known.has(keyOf(f)))) continue;
    seen.push(next);
    chosen.push({
      id: `v-${shortHash(JSON.stringify([candidate.kind, candidate.actions]))}`,
      kind: candidate.kind,
      label: candidate.label,
      summary: candidate.summary,
      actions: candidate.actions,
      spec: next,
      warnings: findings.filter((f) => f.severity === "warning"),
    });
  }
  return chosen;
}

export interface RemixAsk {
  readonly era: Era;
  /** A kit style the garment offers. */
  readonly family: string;
}

/** Four era-true variants of a design in one pattern family. Empty when the garment has no such family. */
export function retroRemix(spec: GarmentSpec, ask: RemixAsk, gate?: VariantGate): readonly Variant[] {
  if (!kitStylesFor(spec.typeId).some((style) => style.id === ask.family)) return [];
  const palette = eraPalette(clubColoursFrom(spec), ask.era);
  return validVariants(spec, candidatesOf(spec, ask.family, arrangements(palette, `${ERA_LABELS[ask.era]} remix`)), gate);
}

export interface RecolourAsk {
  readonly main: string;
  readonly second: string | null;
}

/** The design in new colours, keeping its kit pattern. */
export function recolourKit(spec: GarmentSpec, ask: RecolourAsk, gate?: VariantGate): readonly Variant[] {
  const current = clubColoursFrom(spec);
  const colours: ClubColours = { main: ask.main, second: ask.second ?? current.second, third: current.third };
  const style = spec.kitPattern?.style ?? "plain";
  return validVariants(spec, candidatesOf(spec, style, arrangements(colours, "New colours")), gate);
}

/** The era's one line, for the form. */
export const eraLead = (era: Era): string => ERA_SHIFTS[era].lead;
