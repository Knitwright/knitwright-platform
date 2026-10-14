import { createHash } from "node:crypto";
import type { RosterRow } from "@/lib/production/contract";

/**
 * A fingerprint of a roster, kept in a release instead of the names themselves. Rows are put in
 * a fixed order, so the same players hash the same whichever way they were typed in. A release
 * can say "the team list has changed" without keeping anyone's name.
 */
export function rosterHash(rows: readonly RosterRow[]): string {
  const lines = rows
    .map((r) => JSON.stringify([r.number, r.name, r.sizeLabel, r.cut, r.quantity]))
    .sort();
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}
