import { createHash } from "node:crypto";

/**
 * What a pattern request freezes: the design as saved in one version. The factory file is made from the same design, so the
 * hash names both. No date, no random id and no unordered map goes in, so the same design always has the same hash.
 */
type SnapshotInput = Readonly<{ projectId: string; version: number; garmentType: string; name: string; spec: unknown }>;

export type Snapshot = Readonly<{
  projectId: string;
  version: number;
  garmentType: string;
  name: string;
  spec: unknown;
  sent: readonly string[];
}>;

const SENT_TEXT: readonly string[] = ["The design as saved in this version", "The factory file (tech pack) made from it"];

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v ?? null)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const buildSnapshot = (input: SnapshotInput): Snapshot => ({ ...input, sent: SENT_TEXT });

export const snapshotHash = (snapshot: Snapshot): string => createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
