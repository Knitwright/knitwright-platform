import type { BlockView } from "@/lib/pattern-library/records";
import { slotFor } from "@/lib/pattern-library/slots";

export const HAS_PATTERN_TEXT = "This garment already has a pattern in your library.";
export const NO_SLOT_TEXT = "Knitwright has no pattern slot for this garment, so it cannot be sent as a pattern request yet.";

type Eligibility = Readonly<{ ok: true } | { ok: false; reason: string }>;

/**
 * A design can be sent to the pattern service when its article has no pattern block in the brand's library
 * (the "No pattern yet" slots, decisions 0029 and 0037). Socks are a knitting programme, not a pattern, and are not drafted here.
 */
export function eligibleForPatternService(garmentType: string, blocks: readonly BlockView[]): Eligibility {
  const slot = slotFor(garmentType);
  if (!slot || slot.kind !== "pieces") return { ok: false, reason: NO_SLOT_TEXT };
  if (blocks.some((b) => b.productKey === garmentType && b.kind === "pieces")) return { ok: false, reason: HAS_PATTERN_TEXT };
  return { ok: true };
}
