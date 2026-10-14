import { z } from "zod";
import type { ArtworkStack } from "@/lib/artwork-stack/schema";
import type { PatternLayer } from "@/lib/artwork-stack/layers";
import { chooseOption, paramForWord, stepParam, type Step } from "@/lib/pattern-generators/assistant";
import { findGenerator } from "@/lib/pattern-generators/registry";

/**
 * The assistant's side of pattern styles (plan W7c): "make the camo bigger and darker green". A model names the
 * pattern and the plain words the person used; the words become whole steps of the pattern's own settings, never a
 * number the model made up. A step past the end of a range stops there and says so. Everything changed is marked as
 * suggested by the assistant.
 */

export const setArtworkStyleWire = z.strictObject({
  type: z.literal("set-artwork-style"),
  /** The pattern, such as "camo". */
  generatorId: z.string().min(1).max(40),
  /** Which layer, when the design has two of the same pattern. */
  layerId: z.string().max(80).optional(),
  /** Plain words such as "bigger" or "busier", each one step, or `times` steps. */
  steps: z.array(z.strictObject({ word: z.string().min(1).max(40), times: z.number().int().min(1).max(5).optional() })).max(8).default([]),
  /** A pick from a list, such as the shape "hexagons". */
  choices: z.array(z.strictObject({ param: z.string().min(1).max(40), name: z.string().min(1).max(40) })).max(4).default([]),
  /** Lighten or darken one of the pattern's colours, named by its colour ("green") or its id. */
  colour: z.strictObject({ target: z.string().min(1).max(40), tone: z.enum(["darker", "lighter"]) }).optional(),
});
export type SetArtworkStyleWire = z.output<typeof setArtworkStyleWire>;

export const ARTWORK_STYLE_PROMPT = `{"type": "set-artwork-style", "generatorId": "camo", "steps": [{"word": "bigger"}], "colour": {"target": "green", "tone": "darker"}}  changes a pattern in the design by plain words: each word is one step of that pattern's own settings (bigger, smaller, busier, sparser, wider, tighter); "choices" picks a shape or kind by name; "colour" makes one of the pattern's colours darker or lighter. Never give a number.`;

export type StyleResult =
  | { readonly ok: true; readonly stack: ArtworkStack; readonly steps: readonly Step[]; readonly notes: readonly string[] }
  | { readonly ok: false; readonly reason: string };

const COLOUR_STEP = 0.12;

interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

function toHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }: Hsl): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** A colour's plain name from its hue: the word a person would use to point at it. */
export function hueName(hex: string): string {
  const { h, s, l } = toHsl(hex);
  if (l < 0.08) return "black";
  if (l > 0.94) return "white";
  if (s < 0.12) return "grey";
  const bands: readonly (readonly [number, string])[] = [[15, "red"], [45, "orange"], [70, "yellow"], [165, "green"], [200, "teal"], [260, "blue"], [330, "purple"], [345, "pink"]];
  return bands.find(([top]) => h < top)?.[1] ?? "red";
}

export function shiftLightness(hex: string, tone: "darker" | "lighter"): string {
  const hsl = toHsl(hex);
  return fromHsl({ ...hsl, l: Math.min(0.95, Math.max(0.05, hsl.l + (tone === "darker" ? -COLOUR_STEP : COLOUR_STEP))) });
}

const isHex = (value: string | undefined): value is string => value !== undefined && /^#[0-9a-fA-F]{6}$/.test(value);

/** The colour of the pattern named by the person: by id, else the first of the pattern's colours with that hue. */
function colourToChange(stack: ArtworkStack, layer: PatternLayer, target: string): string | null {
  const wanted = target.trim().toLowerCase();
  const own = layer.colourIds.filter((id) => stack.colours.some((entry) => entry.id === id));
  return own.find((id) => id === wanted) ?? own.find((id) => hueName(stack.colours.find((entry) => entry.id === id)?.screen ?? "#000000") === wanted) ?? null;
}

function recoloured(stack: ArtworkStack, colourId: string, tone: "darker" | "lighter"): ArtworkStack {
  const change = <T extends { readonly screen?: string | undefined; readonly provenance: string }>(entry: T): T =>
    isHex(entry.screen) ? { ...entry, screen: shiftLightness(entry.screen, tone), provenance: "ai-suggested" } : entry;
  return {
    ...stack,
    colours: stack.colours.map((entry) => (entry.id === colourId ? change(entry) : entry)),
    colourways: stack.colourways.map((way) => (way.colours[colourId] === undefined ? way : { ...way, colours: { ...way.colours, [colourId]: change(way.colours[colourId]) } })),
  };
}

function targetLayer(stack: ArtworkStack, wire: SetArtworkStyleWire): PatternLayer | null {
  const found = stack.layers.find((layer): layer is PatternLayer => layer.kind === "pattern" && (wire.layerId === undefined ? layer.generatorId === wire.generatorId : layer.id === wire.layerId));
  return found ?? null;
}

/** Applies the assistant's words to a pattern layer of the stack. The stack given is never changed. */
export function applyArtworkStyle(stack: ArtworkStack, wire: SetArtworkStyleWire): StyleResult {
  const generator = findGenerator(wire.generatorId);
  if (generator === undefined) return { ok: false, reason: `Knitwright has no pattern called ${wire.generatorId}.` };
  const layer = targetLayer(stack, wire);
  if (layer === null) return { ok: false, reason: `This design has no ${generator.label.toLowerCase()} pattern to change.` };
  const steps: Step[] = [];
  const notes: string[] = [];
  let params: Record<string, number | string | boolean> = { ...layer.params };
  const take = (step: Step | null, missing: string): void => {
    if (step === null) notes.push(missing);
    else {
      steps.push(step);
      params = { ...params, [step.paramId]: step.after };
    }
  };
  for (const { word, times } of wire.steps) {
    const found = paramForWord(generator, word);
    take(found === null ? null : stepParam(generator, params, found.paramId, found.direction, times), `${generator.label} cannot be made "${word}".`);
  }
  for (const { param, name } of wire.choices) take(chooseOption(generator, params, param, name), `${generator.label} has no choice "${name}".`);
  let next: ArtworkStack = steps.length === 0 ? stack : { ...stack, layers: stack.layers.map((entry) => (entry.id === layer.id ? { ...layer, params, provenance: "ai-suggested" } : entry)) };
  if (wire.colour !== undefined) {
    const colourId = colourToChange(next, layer, wire.colour.target);
    if (colourId === null) notes.push(`No ${wire.colour.target} in this pattern's colours.`);
    else next = recoloured(next, colourId, wire.colour.tone);
  }
  if (next === stack) return { ok: false, reason: notes[0] ?? "Nothing to change." };
  return { ok: true, stack: next, steps, notes: [...steps.filter((step) => step.clamped).map((step) => step.sentence), ...notes] };
}
