import { migrateSpec, repairSpec, type GarmentSpec } from "@/lib/garment";

type SnapshotCopy =
  | Readonly<{ ok: true; spec: GarmentSpec }>
  | Readonly<{ ok: false; reason: string }>;

const UNUSABLE = "This template cannot be used right now. Choose another, or start from a blank canvas.";

/**
 * The design a new project starts as when a person uses a template: a deep copy of the stored
 * snapshot, read the way the editor reads a stored design (an old format is upgraded, and a choice the
 * registry no longer has is repaired). The copy shares nothing with the template, and nothing links back to it.
 */
export function specFromSnapshot(snapshot: unknown): SnapshotCopy {
  // JSON, not structuredClone: a stored snapshot is JSON, and this drops anything that is not.
  const detached: unknown = snapshot === undefined ? undefined : JSON.parse(JSON.stringify(snapshot));
  const migrated = migrateSpec(detached);
  if (!migrated.ok) return { ok: false, reason: UNUSABLE };
  if (!migrated.stale) return { ok: true, spec: migrated.spec };
  const repaired = repairSpec(migrated.spec);
  return repaired.ok ? { ok: true, spec: repaired.spec } : { ok: false, reason: UNUSABLE };
}
