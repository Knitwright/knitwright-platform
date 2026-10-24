import { createHash } from "node:crypto";
import type { Finding } from "@/lib/production/contract";

/** Blockers first, then by code, article and panel, so a list has one order. */
export function sortFindings(findings: readonly Finding[]): readonly Finding[] {
  const rank = (f: Finding) => (f.severity === "blocker" ? 0 : 1);
  return [...findings].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.code.localeCompare(b.code) ||
      (a.article ?? "").localeCompare(b.article ?? "") ||
      (a.panel ?? "").localeCompare(b.panel ?? ""),
  );
}

/** SHA-256 of the findings in their one order. The same findings always give the same hash. */
export function findingsHash(findings: readonly Finding[]): string {
  return createHash("sha256").update(JSON.stringify(sortFindings(findings))).digest("hex");
}
