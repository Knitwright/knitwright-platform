import type { DrawnAsset, LaunchAsset } from "@/lib/launch";
import { MARKETING_RULE } from "./rules";
import type { ColourRole, MarketingSlot } from "./templates/types";

/**
 * WHAT MAY GO IN A SLOT (spec decision 13; plan v5 L4, decision 0094).
 *
 * A marketing board is a board the platform draws itself, so its output may be a print file (L1,
 * `lib/launch/boards.ts`). That makes this file the place where a generated picture would reach
 * artwork if anything could, so it is shut the same way L1 shuts its own seam, in three places:
 *
 *   * **In the type system.** A picture fill carries a `DrawnAsset` -- the platform's own render or
 *     a golden-sample photograph. `SceneAsset`, which is what a model produces, has no place in
 *     `SlotFill` at all, so a generated picture **cannot be written down** as the contents of a
 *     slot. Code that tries does not compile.
 *   * **At the seam.** `fillSlot` asks again at runtime, because a fill may be built from a row or
 *     a service reply the compiler never saw.
 *   * **In the words.** `Write for me` returns `string[]` and fills only a text slot
 *     (`copy/write.ts`), so a model's output can be words in a field and nothing else.
 *
 * `garment-lock.test.ts` casts past the compiler and watches each door shut. Nothing here decides
 * whether a picture is accurate: `lib/media-check` does that.
 */

/** What one slot holds. A picture is one the platform drew; words are words; a colour is a role. */
export type SlotFill =
  | Readonly<{ kind: "picture"; asset: DrawnAsset }>
  | Readonly<{ kind: "words"; text: string }>
  | Readonly<{ kind: "colour"; role: ColourRole; hex: string }>
  | Readonly<{ kind: "empty" }>;

export type FillVerdict = Readonly<{ ok: true; fill: SlotFill }> | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): FillVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });

/** Said when something a model made is offered as the picture in a layout. */
export const GENERATED_IS_NEVER_ARTWORK =
  "A generated picture is scenery. It never becomes the picture in a layout or part of a print file.";

/** Which kinds of fill each kind of slot takes. A mockup slot takes a picture and nothing else. */
const TAKES: Readonly<Record<MarketingSlot["kind"], readonly SlotFill["kind"][]>> = {
  mockup: ["picture", "empty"],
  logo: ["picture", "empty"],
  text: ["words", "empty"],
  qr: ["words", "empty"],
  shape: ["colour", "empty"],
};

const provenanceOf = (fill: SlotFill): string | null => (fill.kind === "picture" ? (fill.asset as LaunchAsset).provenance : null);

/**
 * Whether this fill may go in this slot. Refused for a fill of the wrong kind, for a picture that
 * came out of a model, and for words longer than the field takes.
 */
export function fillSlot(slot: MarketingSlot, fill: SlotFill): FillVerdict {
  if (!TAKES[slot.kind].includes(fill.kind)) {
    return refuse(`${slot.label} does not take that.`);
  }
  // The runtime door: a value from a row or a service was never seen by the compiler.
  if (provenanceOf(fill) === "generated") return refuse(GENERATED_IS_NEVER_ARTWORK);
  if (fill.kind === "words" && slot.limit !== null && fill.text.length > slot.limit) {
    return refuse(`${slot.label} takes up to ${slot.limit} characters.`);
  }
  return { ok: true, fill };
}

/** Every fill a layout has been given, by slot id, with any refusal named. */
export type FilledLayout = Readonly<{ fills: ReadonlyMap<string, SlotFill>; refusals: readonly string[] }>;

/**
 * The fills a layout accepts, and the reasons for the ones it does not. Nothing is dropped
 * silently: a refused fill is a sentence the panel shows beside the slot.
 */
export function fillLayout(slots: readonly MarketingSlot[], offered: ReadonlyMap<string, SlotFill>): FilledLayout {
  const fills = new Map<string, SlotFill>();
  const refusals: string[] = [];
  for (const slot of slots) {
    const fill = offered.get(slot.id);
    if (fill === undefined) continue;
    const verdict = fillSlot(slot, fill);
    if (verdict.ok) fills.set(slot.id, verdict.fill);
    else refusals.push(verdict.reason);
  }
  return { fills, refusals };
}

/** Which slots a person still has to fill, so the panel can say what is missing rather than look ready. */
export const emptySlots = (slots: readonly MarketingSlot[], filled: FilledLayout): readonly MarketingSlot[] =>
  slots.filter((slot) => slot.kind !== "shape" && !filled.fills.has(slot.id));
