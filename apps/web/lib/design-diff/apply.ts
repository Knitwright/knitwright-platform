import type { GarmentSpec, SpecAction } from "@/lib/garment";
import type { FactoryProfile } from "@/lib/validation";
import type { DesignDiff } from "./diff";
import { previewDiff, type GuardrailRun } from "./preview";

interface ApplyDeps {
  /** The version the person was looking at. The save refuses if the design has moved on. */
  readonly expectedVersion: number;
  /** Stores the actions as one new version (the existing version-save path). */
  readonly save: (actions: readonly SpecAction[], explanations: readonly string[]) => Promise<{ ok: true; version: number } | { ok: false; reason: string }>;
  readonly guardrails?: GuardrailRun;
}

/** Validates the diff again, then makes it the next version. Nothing is saved when the preview fails. */
export async function applyDiff(
  spec: GarmentSpec,
  diff: DesignDiff,
  profile: FactoryProfile,
  deps: ApplyDeps,
): Promise<{ ok: true; version: number } | { ok: false; reason: string }> {
  const preview = previewDiff(spec, diff, profile, deps.guardrails);
  if (!preview.ok) return preview;
  return deps.save(preview.actions, preview.changes);
}
