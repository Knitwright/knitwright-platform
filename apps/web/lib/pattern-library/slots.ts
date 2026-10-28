import { LAUNCH_GARMENTS } from "@/lib/config/launch-garments";
import { getType, TEAMWEAR_TYPE_IDS } from "@/lib/garment";
import type { BlockView } from "./records";

/**
 * The library's slots: one for each product, so the owner sees what has a pattern and what is
 * still missing. Products fashionINSTA cannot draft say so in plain words. Socks are a knitting
 * programme, not a pattern, and hold the factory's programme and a size map, never pieces.
 */

type SlotKind = "pieces" | "knit-programme";

export type Slot = Readonly<{
  productKey: string;
  label: string;
  kind: SlotKind;
  /** True when no pattern service drafts this product, so a technician or the owner must supply one. */
  needsDraft: boolean;
}>;

/** Garments the owner's pattern service cannot draft (plans/production-outputs.md, owner input P2). */
const NEEDS_DRAFT: ReadonlySet<string> = new Set([
  "shorts", "singlet", "skort", "pullover-hoodie", "zip-hoodie", "track-jacket", "raglan-jersey", "polo",
]);

const LABELS: Readonly<Record<string, string>> = {
  "crew-tee": "Crew tee",
  "v-neck-tee": "V-neck tee",
  "long-sleeve-tee": "Long-sleeve tee",
  polo: "Polo with knit collar",
  "team-jersey": "Team jersey",
  "raglan-jersey": "Raglan jersey",
  shorts: "Football shorts",
  skort: "Skort",
  joggers: "Joggers",
  "track-pants": "Track pants",
  "pullover-hoodie": "Pullover hoodie",
  "zip-hoodie": "Zip hoodie",
  "track-jacket": "Track jacket",
  singlet: "Singlet",
  vest: "Vest",
  socks: "Socks",
};

/** Teamwear has no pattern in the library and no pattern service drafts it, so every slot says so. */
const KEYS: readonly string[] = [...new Set([...LAUNCH_GARMENTS, ...TEAMWEAR_TYPE_IDS, "skort", "raglan-jersey", "socks"])];

const isSock = (productKey: string): boolean => productKey === "socks" || productKey === "football-socks";

export const SLOTS: readonly Slot[] = KEYS.map((productKey) => ({
  productKey,
  label: LABELS[productKey] ?? getType(productKey)?.label ?? productKey,
  kind: isSock(productKey) ? "knit-programme" : "pieces",
  needsDraft: NEEDS_DRAFT.has(productKey) || (TEAMWEAR_TYPE_IDS.includes(productKey) && !isSock(productKey)),
}));

export const slotFor = (productKey: string): Slot | undefined => SLOTS.find((slot) => slot.productKey === productKey);

export const NO_PATTERN_TEXT = "No pattern yet: needs a technician's draft or your DXF.";
export const NO_PROGRAMME_TEXT = "No programme yet: needs the sock factory's knitting file and a size map.";
export const ASK_TEXT = "No pattern yet. Make one from a design, or upload your own DXF.";

/** What a slot with no block in it says. */
export function emptySlotText(slot: Slot): string {
  if (slot.kind === "knit-programme") return NO_PROGRAMME_TEXT;
  return slot.needsDraft ? NO_PATTERN_TEXT : ASK_TEXT;
}


export type SlotState = Readonly<{
  slot: Slot;
  /** The newest version for each wearer and cut. */
  blocks: readonly BlockView[];
  /** Said when the slot holds nothing. */
  emptyText: string | null;
}>;

/** Each slot with the newest block of every wearer and cut filed under it. */
export function describeSlots(blocks: readonly BlockView[]): SlotState[] {
  return SLOTS.map((slot) => {
    const mine = blocks.filter((b) => b.productKey === slot.productKey);
    const newest = new Map<string, BlockView>();
    for (const block of mine) {
      const key = `${block.wearer}/${block.cut}`;
      const held = newest.get(key);
      if (!held || block.version > held.version) newest.set(key, block);
    }
    const chosen = [...newest.values()].sort((a, b) => a.wearer.localeCompare(b.wearer) || a.cut.localeCompare(b.cut));
    return { slot, blocks: chosen, emptyText: chosen.length === 0 ? emptySlotText(slot) : null };
  });
}
