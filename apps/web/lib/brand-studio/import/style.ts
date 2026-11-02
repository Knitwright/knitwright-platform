/**
 * The written visual style of F-S9: **Setting**, **Art direction** and **Rules & boundaries**,
 * written from five or more of the brand's own reference pictures.
 *
 * Three rules shape this file.
 *
 * 1. **The model never draws anything.** Spec decision 13: AI output becomes parameters and words,
 *    never pixels on a panel and never a print file. A writer here returns exactly three strings.
 *    There is no field it could put a picture in, and `never-draws.test.ts` proves the three texts
 *    are all that ever leave it and that nothing downstream turns them into a layer.
 * 2. **No live paid call from a test or a local run.** The writer is an interface with a
 *    deterministic stub. The real adapter goes through `lib/providers/text-model.ts` and its
 *    existing key, adds no vendor of its own, and is reached only when a key is configured.
 * 3. **Five pictures, or nothing.** F-S9 says "written automatically from 5+ reference images", so
 *    fewer than the allowance refuses rather than writing something from less. The three texts are
 *    then left empty and the brand writes them by hand, which is what Y6 already offers.
 *
 * One honest limitation, recorded in decision 0102: the shared provider interface takes **one**
 * picture per call (`ModelRequest.image`), so the real adapter sends the facts of every picture as
 * words and the first picture as the one image the interface allows. A true five-picture reading
 * needs that interface to take an array, which is an orchestrator question, not a thing this
 * workstream may change.
 */

import { callCost, type ModelEntry } from "@/lib/providers/catalog";
import { ModelCallError, type ModelImage, type TextModelProvider } from "@/lib/providers/text-model";
import type { UsageMeter } from "@/lib/usage/meter";
import { STYLE_FIELDS, type StyleField } from "../words";
import type { ImportedStyle, PictureFacts } from "./types";
import { DRAFT_LABEL } from "./words";

/** What the writer is told about each of the brand's pictures. Words and numbers, never bytes. */
export type StyleFact = Readonly<{ shape: string; colours: readonly string[]; said: string | null }>;

export interface StyleInput {
  readonly brandName: string;
  readonly host: string;
  /** The page's own title, as words. Null when it had none. */
  readonly title: string | null;
  readonly facts: readonly StyleFact[];
  /** The one picture the shared provider interface takes. Absent for the stub. */
  readonly picture?: ModelImage;
}

export interface VisualStyleWriter {
  /** "stub", or the model id. Kept with the proposal so a reader knows what wrote the texts. */
  readonly name: string;
  write(input: StyleInput, signal?: AbortSignal): Promise<ImportedStyle>;
}

export const EMPTY_STYLE: ImportedStyle = { setting: "", artDirection: "", rulesBoundaries: "" };

/** The reply is three short paragraphs, so a thousand characters of output is plenty. */
export const STYLE_MAX_OUTPUT_TOKENS = 700;

/** The facts of a few pictures plus the instructions, and one 768 px picture. An estimate, labelled. */
export const STYLE_INPUT_TOKENS_ESTIMATE = 4_000;

export const styleCostMicrodollars = (entry: ModelEntry): number => callCost(entry, STYLE_INPUT_TOKENS_ESTIMATE, STYLE_MAX_OUTPUT_TOKENS);

/** What one picture is, in the words the writer is given. "1200 × 1200 px, mostly #0b1f4b and #ffd100". */
export const factOf = (facts: PictureFacts): StyleFact => ({
  shape: `${facts.widthPx} × ${facts.heightPx} px`,
  colours: facts.swatches.slice(0, 3).map((swatch) => swatch.hex),
  said: facts.alt,
});

export const STYLE_SYSTEM = [
  "You write three short paragraphs about how one sportswear brand's own pictures look.",
  "You are given the sizes and the main colours of several of the brand's pictures, what the brand called each one, and one of the pictures.",
  "Answer with JSON only, in this shape:",
  '{"setting":string,"artDirection":string,"rulesBoundaries":string}',
  "setting: where the pictures are taken — the place, the weather, the time of day.",
  "artDirection: how they look — the lens, the light, the mood, the colour grade.",
  "rulesBoundaries: what must never appear in a picture of this brand, and what must always appear.",
  "Each paragraph is at most 80 words, in plain British English, and says only what the pictures show.",
  "Never describe a garment's construction, its seams, its panels or its pattern: you are describing photographs, not clothes.",
  "Never name a real photographer, brand, league, club or sponsor.",
  "Say nothing you cannot point at. A short paragraph is a good answer.",
].join("\n");

export const userPrompt = (input: StyleInput): string =>
  [
    `Brand: ${input.brandName}`,
    input.title === null ? "" : `Page title: ${input.title}`,
    `Pictures (${input.facts.length}):`,
    ...input.facts.map((fact, at) => `${at + 1}. ${fact.shape}, mainly ${fact.colours.join(", ") || "one colour"}${fact.said === null ? "" : `, called "${fact.said}"`}`),
  ]
    .filter((line) => line !== "")
    .join("\n");

const asJson = (text: string): unknown => {
  const trimmed = text.trim();
  const body = trimmed.startsWith("```") ? trimmed.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "") : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

/** At most this many characters per text. The database holds the same limit (`LIMITS.styleText`). */
const MOST_CHARS = 1000;

/**
 * The parser, not the model, decides what a style may say: three strings, trimmed, with control
 * characters out and nothing else carried over. A reply in any other shape yields empty texts.
 */
export function styleFrom(reply: unknown): ImportedStyle {
  const said = (reply ?? {}) as Record<string, unknown>;
  const text = (field: StyleField): string => {
    const value = said[field];
    return typeof value === "string" ? value.replace(/\p{C}/gu, " ").replace(/[ \t]+/g, " ").trim().slice(0, MOST_CHARS) : "";
  };
  return Object.fromEntries(STYLE_FIELDS.map((field) => [field, text(field)])) as unknown as ImportedStyle;
}

/**
 * The deterministic stub. It writes the three texts from the facts it was given and nothing else:
 * the same facts in, the same words out, every run, so a test can pin them. It never reaches the
 * network and it costs nothing.
 */
export function createStubStyleWriter(): VisualStyleWriter {
  return {
    name: "stub",
    async write(input) {
      const colours = [...new Set(input.facts.flatMap((fact) => fact.colours))].slice(0, 3);
      const named = colours.join(", ") || "one colour";
      return {
        setting: `Read from ${input.facts.length} of your own pictures on ${input.host}. ${DRAFT_LABEL}: a person writes this paragraph, and this stub only says what was read.`,
        artDirection: `Your pictures are mainly ${named}, at sizes from ${input.facts[0]?.shape ?? "an unknown size"}. Say here how you want the light, the lens and the mood.`,
        rulesBoundaries: "Say here what must never appear in a picture of your brand, and what must always appear. Nothing was assumed for you.",
      };
    },
  };
}

/** Answers from a script, in order; the last answer repeats. For tests only. Never reaches the network. */
export function createScriptedStyleWriter(answers: readonly (ImportedStyle | Error)[]): VisualStyleWriter & { calls: number; seen: StyleInput[] } {
  const writer = {
    name: "scripted",
    calls: 0,
    seen: [] as StyleInput[],
    async write(input: StyleInput): Promise<ImportedStyle> {
      const answer = answers[Math.min(writer.calls, answers.length - 1)];
      writer.calls += 1;
      writer.seen.push(input);
      if (answer === undefined) throw new ModelCallError("The scripted writer was given no answer.");
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return writer;
}

/** The real adapter. Reached only when a key is configured, and never from a test. */
export function createModelStyleWriter(provider: TextModelProvider): VisualStyleWriter {
  return {
    name: provider.model,
    async write(input, signal) {
      const reply = await provider.complete({
        system: STYLE_SYSTEM,
        user: userPrompt(input),
        ...(input.picture ? { image: input.picture } : {}),
        maxOutputTokens: STYLE_MAX_OUTPUT_TOKENS,
        signal,
      });
      return styleFrom(asJson(reply.text));
    },
  };
}

type Who = Readonly<{ brandId: string; userId: string }>;

export const ALLOWANCE_USED_UP = "The AI allowance is used up, so your visual style cannot be written yet.";

/**
 * A writer that pays through the usage meter like every other AI call. The cost is reserved before
 * the call, against the person and brand who asked, and given back when the call fails. The same
 * shape as `lib/benchmarks/metered.ts`, so there is one way of doing this in the codebase.
 */
export function meteredStyleWriter(writer: VisualStyleWriter, meter: UsageMeter, who: Who, cost: number, route: string): VisualStyleWriter {
  return {
    name: writer.name,
    async write(input, signal) {
      const reservation = await meter.reserve({ userId: who.userId, brandId: who.brandId, cost: { feature: "ai", microdollars: cost }, route });
      if (!reservation.ok) throw new Error(ALLOWANCE_USED_UP);
      try {
        return await writer.write(input, signal);
      } catch (error) {
        await meter.refund(reservation.eventId).catch(() => false);
        throw error;
      }
    },
  };
}
