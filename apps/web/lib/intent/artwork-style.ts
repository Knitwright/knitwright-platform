import { z } from "zod";
import type { ArtworkStack } from "@/lib/artwork-stack/schema";
import { artworkStackSchema } from "@/lib/artwork-stack/schema";
import { resolveColour } from "@/lib/artwork-stack/colours";
import type { PatternLayer } from "@/lib/artwork-stack/layers";
import { darken, hslOf, hueWord, lighten } from "@/lib/pattern-generators/colour";
import { applySteps, generatorFromWords, stepsAsked, wordsToSteps, choicesFromWords, type WordStep } from "@/lib/pattern-generators/assistant";
import { getGenerator } from "@/lib/pattern-generators/registry";
import { getPreset } from "@/lib/pattern-generators/presets";
import { choiceName } from "@/lib/pattern-generators/params";

/**
 * The assistant's side of pattern styles (plan W7c): "make the camo bigger and darker green". A reading of the words
 * moves a layer's settings by their own steps and shades its colours, with a before and an after for each, and says
 * so when a step stops at the end of a range. No model is needed to read these words, and the assistant never picks a
 * number: a step is the setting's own step. The change is to a stack (the design's artwork), as a new stack.
 *
 * Wiring this into the editor's change list needs a change type that carries a stack and a line in the reply schema.
 * Neither file is this workstream's (`lib/garment/**`, `reply-schema.ts`), so this file stands alone and is exported
 * from `to-spec-action.ts` by one registration line.
 */

const id = z.string().min(1).max(64);

export const setArtworkStyleWire = z.strictObject({
  type: z.literal("set-artwork-style"),
  generatorId: id,
  presetId: id.optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
});

const stepWire = z.strictObject({ paramId: id, direction: z.enum(["up", "down"]), steps: z.number().int().min(1).max(5) });
const shadeWire = z.strictObject({ shade: z.enum(["darker", "lighter"]), hue: z.string().max(20).optional(), steps: z.number().int().min(1).max(5) });

export const adjustArtworkStyleWire = z.strictObject({
  type: z.literal("adjust-artwork-style"),
  /** The pattern layer; the only one when left out. */
  layerId: id.optional(),
  changes: z.array(stepWire).max(8),
  /** Pick-one settings named in words, by position. */
  picks: z.record(id, z.number().int().min(0).max(9)).optional(),
  colour: shadeWire.optional(),
  /** A different seed, for another arrangement of the same style. */
  reseed: z.number().int().min(0).max(2_147_483_647).optional(),
});

export type SetArtworkStyleWire = z.output<typeof setArtworkStyleWire>;
export type AdjustArtworkStyleWire = z.output<typeof adjustArtworkStyleWire>;

export const ARTWORK_STYLE_PROMPT = `{"type": "set-artwork-style", "generatorId": "camo", "presetId": "camo-woodland"}  puts a printed style over the body; the styles and presets are in the style list
{"type": "adjust-artwork-style", "changes": [{"paramId": "scale", "direction": "up", "steps": 1}], "colour": {"shade": "darker", "hue": "green", "steps": 1}}  moves a style's settings up or down by their own steps and shades its colours; never state a number`;

export interface StyleStep {
  readonly what: string;
  readonly before: string;
  readonly after: string;
}

export type StyleResult =
  | { readonly ok: true; readonly stack: ArtworkStack; readonly steps: readonly StyleStep[]; readonly notes: readonly string[] }
  | { readonly ok: false; readonly reason: string };

const NOTHING = "Nothing was changed.";
const fail = (reason: string): StyleResult => ({ ok: false, reason: `${reason} ${NOTHING}` });

const patternLayers = (stack: ArtworkStack): PatternLayer[] => stack.layers.filter((layer): layer is PatternLayer => layer.kind === "pattern");

const withLayer = (stack: ArtworkStack, layer: PatternLayer): ArtworkStack => ({ ...stack, layers: stack.layers.map((entry) => (entry.id === layer.id ? layer : entry)) });

const SHADE_AMOUNT = 0.18;
const FLOOR_LIGHTNESS = 0.04;
const CEILING_LIGHTNESS = 0.96;

type Shade = NonNullable<AdjustArtworkStyleWire["colour"]>;

/** Shades the layer's colours in the first colourway; only the screen colour changes, never a factory code. */
function shadeColours(stack: ArtworkStack, layer: PatternLayer, shade: Shade, generatorLabel: string): { stack: ArtworkStack; steps: StyleStep[]; notes: string[] } {
  const colourway = stack.colourways[0];
  const wanted = shade.hue?.toLowerCase().replace("gray", "grey");
  const picked = layer.colourIds.flatMap((colourId) => {
    const value = resolveColour(stack, colourway.id, colourId);
    return value?.screen === undefined || (wanted !== undefined && hueWord(value.screen) !== wanted) ? [] : [{ colourId, value, screen: value.screen }];
  });
  const none = wanted === undefined ? `${generatorLabel} has no colours to shade.` : `There is no ${wanted} in the ${generatorLabel.toLowerCase()} to make ${shade.shade}.`;
  if (picked.length === 0) return { stack, steps: [], notes: [none] };
  const edge = shade.shade === "darker" ? (hex: string) => hslOf(hex).l <= FLOOR_LIGHTNESS : (hex: string) => hslOf(hex).l >= CEILING_LIGHTNESS;
  const moved = picked.map((entry) => ({ ...entry, after: edge(entry.screen) ? entry.screen : (shade.shade === "darker" ? darken : lighten)(entry.screen, SHADE_AMOUNT * shade.steps) }));
  const colours = { ...colourway.colours, ...Object.fromEntries(moved.map((entry) => [entry.colourId, { ...entry.value, screen: entry.after, provenance: "ai-suggested" as const }])) };
  const changed = moved.filter((entry) => entry.after !== entry.screen);
  return {
    stack: { ...stack, colourways: stack.colourways.map((entry, at) => (at === 0 ? { ...entry, colours } : entry)) },
    steps: changed.map((entry) => ({ what: `${hueWord(entry.screen)[0].toUpperCase()}${hueWord(entry.screen).slice(1)} in the ${generatorLabel.toLowerCase()}`, before: entry.screen, after: entry.after })),
    notes: [
      ...(changed.length < moved.length ? [`That colour is as ${shade.shade === "darker" ? "dark" : "light"} as it goes.`] : []),
      "Only the colour you see on screen changed. Your factory colour code, if you gave one, is as you typed it.",
    ],
  };
}

/** Applies a reading of words to one pattern layer. */
export function applyArtworkStyle(stack: ArtworkStack, wire: AdjustArtworkStyleWire): StyleResult {
  const layers = patternLayers(stack);
  const layer = wire.layerId === undefined ? (layers.length === 1 ? layers[0] : undefined) : layers.find((entry) => entry.id === wire.layerId);
  if (layer === undefined) return fail(layers.length === 0 ? "This design has no printed style to change." : "Say which printed style you mean.");
  const generator = getGenerator(layer.generatorId);
  if (generator === undefined) return fail(`The style ${layer.generatorId} is not one this version knows.`);
  const outcome = applySteps(generator, layer.params, wire.changes.map((change): WordStep => change));
  const picks = Object.entries(wire.picks ?? {}).flatMap(([paramId, at]) => {
    const spec = generator.params.find((entry) => entry.id === paramId) as (typeof generator.params)[number] & { choices?: readonly string[] } | undefined;
    return spec?.choices === undefined || at >= spec.choices.length ? [] : [{ spec, at, was: layer.params[paramId] }];
  });
  const pickSteps = picks.filter((pick) => pick.was !== pick.at).map((pick) => ({ what: pick.spec.label, before: choiceName(pick.spec, typeof pick.was === "number" ? pick.was : pick.spec.default ?? 0) ?? "not set", after: choiceName(pick.spec, pick.at) ?? "" }));
  const params = { ...outcome.params, ...Object.fromEntries(picks.map((pick) => [pick.spec.id, pick.at])) };
  const moved: PatternLayer = { ...layer, params, ...(wire.reseed === undefined ? {} : { seed: wire.reseed }) };
  const shaded = wire.colour === undefined ? { stack: withLayer(stack, moved), steps: [] as StyleStep[], notes: [] as string[] } : shadeColours(withLayer(stack, moved), moved, wire.colour, generator.label);
  const steps: StyleStep[] = [
    ...outcome.changes.map((change) => ({ what: change.label, before: change.before, after: change.after })),
    ...pickSteps,
    ...(wire.reseed === undefined ? [] : [{ what: "Arrangement (seed)", before: String(layer.seed ?? 0), after: String(wire.reseed) }]),
    ...shaded.steps,
  ];
  const notes = [...outcome.sentences, ...shaded.notes];
  const checked = artworkStackSchema.safeParse(shaded.stack);
  if (!checked.success) return fail(checked.error.issues[0]?.message ?? "That change does not fit this design.");
  return steps.length === 0 && notes.length === 0 ? fail("That is already how it is.") : { ok: true, stack: checked.data, steps, notes };
}

const SHADE_WORDS = /\b(darker|deeper|lighter|paler|brighter)(?:\s+(?:shade of\s+)?([a-z]+))?/i;
const COLOUR_HUES = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "grey", "gray", "black", "white"];

function shadeFromWords(text: string): Shade | undefined {
  const found = SHADE_WORDS.exec(text);
  if (found === null) return undefined;
  const hue = COLOUR_HUES.find((name) => name === found[2]?.toLowerCase());
  const darker = /darker|deeper/i.test(found[1]);
  return { shade: darker ? "darker" : "lighter", ...(hue === undefined ? {} : { hue }), steps: stepsAsked(text) };
}

/**
 * Reads "make the camo bigger and darker green" into a change, with no model. Null when the words name no setting and
 * no shade of any printed style of the stack.
 */
export function readArtworkStyleWords(utterance: string, stack: ArtworkStack): AdjustArtworkStyleWire | null {
  const layers = patternLayers(stack);
  const named = generatorFromWords(utterance);
  const layer = layers.find((entry) => entry.generatorId === named?.id) ?? (layers.length === 1 ? layers[0] : undefined);
  const generator = layer === undefined ? undefined : getGenerator(layer.generatorId);
  if (layer === undefined || generator === undefined) return null;
  const changes = wordsToSteps(generator, utterance);
  const picks = choicesFromWords(generator, utterance);
  const shade = shadeFromWords(utterance);
  // "lighter dots" is a setting's own words, not a shade of the colours.
  const claimed = changes.length > 0 && generator.params.some((spec) => [...(spec.words?.up ?? []), ...(spec.words?.down ?? [])].some((word) => /^(darker|deeper|lighter|paler|brighter)\b/.test(word) && utterance.toLowerCase().includes(word)));
  const colour = claimed ? undefined : shade;
  if (changes.length === 0 && colour === undefined && Object.keys(picks).length === 0) return null;
  return {
    type: "adjust-artwork-style",
    layerId: layer.id,
    changes,
    ...(Object.keys(picks).length === 0 ? {} : { picks }),
    ...(colour === undefined ? {} : { colour }),
  };
}

/** Puts a style on the design from a preset: the first printed style is replaced, or one is added over the ground. */
export function setArtworkStyle(stack: ArtworkStack, wire: SetArtworkStyleWire): StyleResult {
  const generator = getGenerator(wire.generatorId);
  if (generator === undefined) return fail(`There is no style called ${wire.generatorId}.`);
  const preset = wire.presetId === undefined ? undefined : getPreset(wire.presetId);
  if (wire.presetId !== undefined && (preset === undefined || preset.generatorId !== generator.id)) return fail(`${generator.label} has no preset called ${wire.presetId}.`);
  const params = preset?.params ?? {};
  const seed = wire.seed ?? preset?.seed ?? 0;
  const existing = patternLayers(stack)[0];
  const grounds = new Set(stack.layers.flatMap((layer) => (layer.kind === "ground" ? [layer.colourId] : [])));
  const free = stack.colours.map((colour) => colour.id).filter((colourId) => !grounds.has(colourId));
  const colourIds = existing?.colourIds ?? free.slice(0, Math.min(generator.maxColours, preset?.colours ?? 2));
  if (colourIds.length === 0) return fail("Add a colour for the style first.");
  const layer: PatternLayer = existing
    ? { ...existing, generatorId: generator.id, params, seed, provenance: "ai-suggested" }
    : { id: `pattern-${generator.id}`, kind: "pattern", views: stack.views, opacity: 1, blend: "normal", provenance: "ai-suggested", generatorId: generator.id, params, seed, datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } }, colourIds };
  const next: ArtworkStack = { ...stack, layers: existing ? stack.layers.map((entry) => (entry.id === existing.id ? layer : entry)) : [...stack.layers, layer] };
  const checked = artworkStackSchema.safeParse(next);
  if (!checked.success) return fail(checked.error.issues[0]?.message ?? "That style does not fit this design.");
  return { ok: true, stack: checked.data, steps: [{ what: "Printed style", before: existing ? (getGenerator(existing.generatorId)?.label ?? existing.generatorId) : "none", after: preset?.label ?? generator.label }], notes: [] };
}

/** The result as sentences for the person: what moved, from what to what, and any limit that was reached. */
export function explainArtworkStyle(result: StyleResult): string[] {
  if (!result.ok) return [result.reason];
  return [...result.steps.map((step) => `${step.what}: from ${step.before} to ${step.after}.`), ...result.notes];
}
