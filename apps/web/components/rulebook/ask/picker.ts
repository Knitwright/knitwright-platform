import { PARTS } from "@/lib/rulebook/ask/best-practice";
import type { BestPracticeCard } from "@/lib/rulebook/ask/types";

/** One part to offer, and whether the card on the screen is the one about it. */
export type PartChoice = Readonly<{ key: string; label: string; chosen: boolean }>;

/**
 * The parts a person may ask about, in the rulebook's own order, with the one on the screen marked.
 *
 * The list is `PARTS` rather than a copy: a part added to the rulebook's definitions appears here without
 * anybody remembering to add it, and `bestPracticeSchema` accepts exactly these keys, so the picker cannot
 * offer a part the action would refuse.
 */
export const partChoices = (card: BestPracticeCard | null): readonly PartChoice[] =>
  PARTS.map((part) => ({ key: part.key, label: part.label, chosen: card !== null && card.part === part.key }));
