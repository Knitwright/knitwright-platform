import { createHash } from "node:crypto";
import { z } from "zod";
import { MAX_TEXT_INPUT_TOKENS, estimateTokens, type ModelEntry } from "@/lib/providers/catalog";
import { ModelCallError, type ModelRequest, type TextModelProvider } from "@/lib/providers/text-model";
import { microdollars } from "@/lib/usage/cost";
import type { UsageMeter } from "@/lib/usage/meter";
import { DESCRIPTION_MAX, MAX_TAGS, TITLE_MAX, cleanTags } from "./listing";

/**
 * "IMPROVE LISTING" (09 screen 23 "AI Improve listing"; prototype p06 "Improve listing (AI, 2 credits)").
 *
 * The model rewrites the listing's WORDS — title, description, tags — and nothing else: it is handed the facts the
 * platform holds and told to invent none. Its reply is untrusted text, parsed and held to each field's limit. It
 * never touches a picture, a price or the garment (spec decision 13).
 *
 * It is paid for twice over, as every AI call here is: the platform's own spend through the usage meter (reserved
 * before the call, given back on a failure), and the brand's credits through the existing ledger (`marketing_media`,
 * the price AI copy and media carry today; the spec's "2 credits" is a placeholder the owner has not confirmed).
 * The same words asked again are not charged again, because the charge is keyed on them. With no model key set it
 * says it is not connected; nothing is faked.
 */

export const IMPROVE_MAX_OUTPUT_TOKENS = 900;
export const NOT_CONNECTED = "Improve listing is not connected yet, so nothing has been sent.";
export const ALLOWANCE_USED_UP = "The AI allowance for this month is used up, so nothing has been written.";
export const NOTHING_USABLE = "Nothing usable came back. Try again, or write it yourself.";
export const UNREACHABLE = "The writer could not be reached. Try again in a moment.";

export interface ImproveFacts {
  readonly listingId: string;
  readonly productName: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly sizes: readonly string[];
  readonly fabric: string | null;
  readonly personalised: boolean;
  readonly brandName: string;
  /** The brand's voice and tone words, from Brand Studio, or "". */
  readonly voice: string;
}

export type Improvement = Readonly<{ title: string; description: string; tags: readonly string[] }>;

export type ImproveResult =
  | Readonly<{ ok: true; improvement: Improvement; model: string; credits: Readonly<{ charged: boolean; price: number; balance: number }> }>
  | Readonly<{ ok: false; reason: string }>;

const SYSTEM = [
  "You improve product listings for a sportswear brand's online shop.",
  "You rewrite the title, the description and the tags, and nothing else.",
  "You invent no fact: no price, no date, no fabric, weight or certification that is not in the facts, no sponsor, and no other brand's name.",
  "You never describe changing the garment, a picture or a layout.",
  `Answer with JSON only: {"title": "...", "description": "...", "tags": ["...", "..."]}. The title is at most ${TITLE_MAX} characters, the description at most 1200, and at most ${MAX_TAGS} short lower-case tags.`,
].join(" ");

const NOT_WORDS = /[\p{Cc}\p{Cf}\p{Cs}]/gu;
const clean = (text: string): string => text.replace(NOT_WORDS, (match) => (match === "\n" ? "\n" : " ")).replace(/[ \t]+/g, " ").trim();

/** The instructions and the facts, as data rather than as a sentence the model could read as an order. */
export function improvePrompt(facts: ImproveFacts): ModelRequest {
  const user = {
    brand: { name: facts.brandName, voiceAndTone: facts.voice || null },
    product: { name: facts.productName, sizes: facts.sizes, fabric: facts.fabric, namesAndNumbers: facts.personalised },
    current: { title: facts.title, description: facts.description.slice(0, 2000), tags: facts.tags },
  };
  return { system: SYSTEM, user: JSON.stringify(user), maxOutputTokens: IMPROVE_MAX_OUTPUT_TOKENS };
}

const replySchema = z.object({ title: z.string(), description: z.string(), tags: z.array(z.string()).max(40) });

/** The improvement in a reply, cleaned and held to each field's limit, or null when the reply is not one. */
export function readImprovement(text: string): Improvement | null {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const parsed = replySchema.safeParse(json);
  if (!parsed.success) return null;
  const title = clean(parsed.data.title).replace(/\n/g, " ").slice(0, TITLE_MAX);
  const description = clean(parsed.data.description).slice(0, DESCRIPTION_MAX);
  if (title.length === 0 || description.length === 0) return null;
  return { title, description, tags: cleanTags(parsed.data.tags) };
}

/** The ledger key of one request: the listing and the words asked about, so asking again is free. */
export function improveHash(facts: ImproveFacts): string {
  const words = JSON.stringify([facts.title, facts.description, facts.tags]);
  return createHash("sha256").update(`listing-improve:${facts.listingId}:${words}`).digest("hex");
}

/** What one call would cost the platform, erring high: the whole prompt and a full reply. */
export function improveCostMicrodollars(entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion">, facts: ImproveFacts): number {
  const prompt = improvePrompt(facts);
  const input = Math.min(estimateTokens(prompt.system) + estimateTokens(prompt.user), MAX_TEXT_INPUT_TOKENS);
  return Math.max(1, microdollars((input * entry.inputPerMillion + IMPROVE_MAX_OUTPUT_TOKENS * entry.outputPerMillion) / 1_000_000));
}

type SpendOutcome =
  | Readonly<{ ok: true; charged: boolean; price: number; balance: number }>
  | Readonly<{ ok: false; reason: "insufficient"; price: number; balance: number }>;

export type ImproveDeps = Readonly<{
  model: Readonly<{ provider: TextModelProvider; entry: Pick<ModelEntry, "inputPerMillion" | "outputPerMillion"> }> | null;
  meter: UsageMeter;
  spend: (hash: string, usageEventId: string) => Promise<SpendOutcome>;
  giveBack: (hash: string) => Promise<void>;
  who: Readonly<{ brandId: string; userId: string }>;
  route: string;
}>;

/** Reserve, charge, call, and give everything back when nothing usable came of it. */
export async function improveListing(deps: ImproveDeps, facts: ImproveFacts): Promise<ImproveResult> {
  if (deps.model === null) return { ok: false, reason: NOT_CONNECTED };
  const cost = improveCostMicrodollars(deps.model.entry, facts);
  const reservation = await deps.meter.reserve({ userId: deps.who.userId, brandId: deps.who.brandId, cost: { feature: "ai", microdollars: cost }, route: deps.route });
  if (!reservation.ok) return { ok: false, reason: ALLOWANCE_USED_UP };
  const hash = improveHash(facts);
  const spent = await deps.spend(hash, reservation.eventId);
  if (!spent.ok) {
    await deps.meter.refund(reservation.eventId).catch(() => false);
    return { ok: false, reason: `Improving a listing costs ${spent.price} credits and the balance is ${spent.balance}. Buy credits or upgrade your plan.` };
  }
  const failed = async (reason: string): Promise<ImproveResult> => {
    await deps.meter.refund(reservation.eventId).catch(() => false);
    if (spent.charged) await deps.giveBack(hash).catch(() => undefined);
    return { ok: false, reason };
  };
  try {
    const reply = await deps.model.provider.complete(improvePrompt(facts));
    const improvement = readImprovement(reply.text);
    if (improvement === null) return failed(NOTHING_USABLE);
    return { ok: true, improvement, model: reply.model, credits: { charged: spent.charged, price: spent.price, balance: spent.balance } };
  } catch (error) {
    if (error instanceof ModelCallError) return failed(UNREACHABLE);
    await failed(UNREACHABLE);
    throw error;
  }
}
