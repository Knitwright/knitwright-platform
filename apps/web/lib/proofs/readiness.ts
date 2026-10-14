import type { ReadinessItem } from "@/lib/production/contract";
import type { StrikeOff } from "./types";

const newest = (rows: readonly StrikeOff[]): StrikeOff | null =>
  rows.reduce<StrikeOff | null>((best, s) => (best === null || s.requestedAt > best.requestedAt ? s : best), null);

/**
 * The "proofs" line of the factory checklist. It is met when the newest strike-off that somebody
 * decided was accepted. A rejected one blocks it until a later one is accepted, and a new request
 * that nobody has decided yet neither blocks nor satisfies it.
 */
export function proofReadiness(strikeOffs: readonly StrikeOff[]): ReadinessItem {
  const decided = newest(strikeOffs.filter((s) => s.status === "accepted" || s.status === "rejected"));
  if (decided?.status === "accepted") {
    return { id: "strike-off", met: true, whoActs: "owner", sentence: `The strike-off was accepted by ${decided.decidedByName ?? "a named person"} on ${decided.decidedOn ?? "a recorded date"}.` };
  }
  if (decided?.status === "rejected") {
    return { id: "strike-off", met: false, whoActs: "print-house", sentence: `The strike-off was rejected by ${decided.decidedByName ?? "a named person"}. A new test print is needed.` };
  }
  const open = newest(strikeOffs);
  if (open?.status === "requested") {
    return { id: "strike-off", met: false, whoActs: "print-house", sentence: "A strike-off has been asked for and has not arrived." };
  }
  if (open?.status === "received") {
    return { id: "strike-off", met: false, whoActs: "owner", sentence: "A strike-off has arrived. Someone needs to accept or reject it." };
  }
  return { id: "strike-off", met: false, whoActs: "owner", sentence: "No strike-off has been asked for." };
}
