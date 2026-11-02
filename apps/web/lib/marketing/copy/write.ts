import { z } from "zod";
import { ModelCallError, type ModelReply, type ModelRequest, type TextModelProvider } from "@/lib/providers/text-model";
import type { Campaign } from "../campaign/steps";
import { CAMPAIGN_LABELS } from "../campaign/steps";
import { MARKETING_RULE } from "../rules";
import type { MarketingSlot } from "../templates/types";
import { hasVoice, voiceWords, type BrandVoice } from "./voice";

/**
 * "WRITE FOR ME" (spec F-L2: "Every text field has **Write for me**, which writes AI copy in the
 * brand's voice and tone"; plan v5 L4, decision 0094).
 *
 * **The model writes words and nothing else.** Spec decision 13 -- AI never draws the garment -- is
 * structural here rather than remembered:
 *
 *   * the one entry point takes a `MarketingSlot` and **refuses any slot whose kind is not `text`**,
 *     so a model cannot be asked to fill a mockup, a logo or a QR chip;
 *   * what comes back is `string[]`, which is not a `LaunchAsset`, so it cannot be handed to
 *     `offerAsset` and cannot become a panel layer or a print file. `garment-lock.test.ts` casts
 *     past the compiler and watches both doors shut.
 *
 * Every reply is untrusted. It is parsed, trimmed, held to the slot's own character limit and
 * emptied of anything that is not words, because a reply is a stranger's text.
 *
 * No call is made from a test or from an agent's own run: a `TextModelProvider` is handed in, and
 * `createStubProvider` is what the tests use. Metering is `metered.ts`, round the same call.
 */

/** A reply is three short options, so a person chooses rather than accepts. */
export const OPTION_COUNT = 3;

/** The fixed cap on a reply, which is a few short lines. */
export const WRITE_MAX_OUTPUT_TOKENS = 400;

export interface WriteRequest {
  /** The text slot being filled. A slot of any other kind is refused. */
  readonly slot: MarketingSlot;
  /** What the person said they want to highlight (the form's step 4), or "". */
  readonly highlight: string;
  readonly campaign: Campaign | null;
  readonly voice: BrandVoice;
  readonly signal?: AbortSignal;
}

export type WriteResult =
  | Readonly<{ ok: true; options: readonly string[]; model: string; usage: ModelReply["usage"] }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): WriteResult => ({ ok: false, reason, ruleId: MARKETING_RULE });

/** Said when a slot is not a text field. The model is never asked to make a picture of anything. */
export const NOT_TEXT = "Write for me fills a text field. It does not draw, replace or change a picture.";

/** Said when the model answered with nothing a field could hold. */
export const NOTHING_USABLE = "Nothing came back that fits this field. Try again, or write it yourself.";

const SYSTEM = [
  "You write short marketing copy for sportswear brands and clubs.",
  "You write words only. You never describe, draw, change or mention changing a garment, a kit, a photograph or a layout.",
  "You answer with JSON: {\"options\": [\"...\", \"...\", \"...\"]}, and nothing else.",
  `You give exactly ${OPTION_COUNT} options.`,
  "You invent no fact: no price, no date, no name, no claim about a fabric, and no sponsor.",
].join(" ");

/** Control characters and the marks that change the direction of text: never wanted in a field. */
const NOT_WORDS = /[\p{Cc}\p{Cf}\p{Cs}]/gu;

const oneLine = (text: string): string => text.replace(NOT_WORDS, " ").replace(/\s+/g, " ").trim();

/** The instructions and the facts, as data rather than as a sentence the model could read as an order. */
export function writePrompt(request: WriteRequest): ModelRequest {
  const facts = {
    field: { name: request.slot.label, style: request.slot.style, mostCharacters: request.slot.limit },
    brand: { name: request.voice.name, voiceAndTone: voiceWords(request.voice), about: request.voice.about },
    campaign: request.campaign ? CAMPAIGN_LABELS[request.campaign] : null,
    highlight: oneLine(request.highlight) || null,
  };
  return {
    system: SYSTEM,
    user: JSON.stringify(facts),
    maxOutputTokens: WRITE_MAX_OUTPUT_TOKENS,
    ...(request.signal ? { signal: request.signal } : {}),
  };
}

const replySchema = z.object({ options: z.array(z.string()).max(12) });

/**
 * The options in a reply, cleaned and held to the field's limit. A reply that is not the shape
 * asked for is read as plain lines instead, because a model that answers in prose has still
 * answered, and nothing here trusts either form.
 */
export function readOptions(text: string, limit: number | null): readonly string[] {
  const json = tryJson(text);
  const parsed = replySchema.safeParse(json);
  // A reply that is JSON but not the shape asked for gives nothing: its own text is not copy.
  if (json !== null && !parsed.success) return [];
  const raw = parsed.success ? parsed.data.options : text.split("\n");
  const cleaned = raw
    .map((line) => oneLine(line).replace(/^[-*\d.)\s]+/, "").replace(/^["']|["']$/g, ""))
    .filter((line) => line.length > 0)
    .filter((line) => limit === null || line.length <= limit);
  return [...new Set(cleaned)].slice(0, OPTION_COUNT);
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Three options for one text field, in the brand's voice. The slot decides whether a model is asked
 * at all: only a text field is, and only a brand with a voice on file.
 */
export async function writeForMe(provider: TextModelProvider, request: WriteRequest): Promise<WriteResult> {
  if (request.slot.kind !== "text") return refuse(NOT_TEXT);
  if (!hasVoice(request.voice)) return refuse("This brand has no voice and tone on file yet, so nothing has been written for it.");
  try {
    const reply = await provider.complete(writePrompt(request));
    const options = readOptions(reply.text, request.slot.limit);
    if (options.length === 0) return refuse(NOTHING_USABLE);
    return { ok: true, options, model: reply.model, usage: reply.usage };
  } catch (error) {
    if (error instanceof ModelCallError) return refuse("The writer could not be reached. Try again in a moment, or write it yourself.");
    throw error;
  }
}
