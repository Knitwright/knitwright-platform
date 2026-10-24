import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { explainChanges } from "@/lib/intent/explain";
import { toSpecAction } from "@/lib/intent/to-spec-action";
import { profileFindings } from "@/lib/validation/checks/profile";
import type { FactoryProfile } from "@/lib/validation";
import type { DesignDiff } from "./diff";

/** The default distance of a move when the person gave none. A labelled setting, not a measurement. */
export const NUDGE_MM = 10;
const TENTHS = 10;

export interface GuardrailNote {
  readonly severity: "blocker" | "warning";
  readonly message: string;
}
/** Checks the design after the change. The guardrails need panel geometry, so the caller supplies this. */
export type GuardrailRun = (after: GarmentSpec) => readonly GuardrailNote[];

export type Preview =
  | {
      readonly ok: true;
      readonly after: GarmentSpec;
      readonly actions: readonly SpecAction[];
      /** Plain sentences for each difference. */
      readonly changes: readonly string[];
      readonly warnings: readonly string[];
    }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): Preview => ({ ok: false, reason });

type Converted = { readonly ok: true; readonly action: SpecAction; readonly extra?: string } | { readonly ok: false; readonly reason: string };

function movement(spec: GarmentSpec, diff: Extract<DesignDiff, { kind: "move-placement" }>): Converted {
  const art = spec.artwork.find((entry) => entry.id === diff.artworkId);
  if (!art) return { ok: false, reason: "This design has no such artwork to move." };
  const given = diff.mm !== undefined;
  const step = Math.round((diff.mm ?? NUDGE_MM) * TENTHS);
  const dx = diff.direction === "left" ? -step : diff.direction === "right" ? step : 0;
  const dy = diff.direction === "up" ? -step : diff.direction === "down" ? step : 0;
  const moved = { ...art, offsetX: art.offsetX + dx, offsetY: art.offsetY + dy, provenance: "ai-suggested" as const };
  const how = given ? `${diff.mm} mm` : `${NUDGE_MM} mm (Knitwright default step)`;
  return { ok: true, action: { type: "update-artwork", artwork: moved }, extra: `${art.name} moved ${diff.direction} by ${how}.` };
}

function convert(spec: GarmentSpec, diff: DesignDiff): Converted {
  switch (diff.kind) {
    case "set-colour": {
      const made = toSpecAction(spec, { type: "set-colour", panels: diff.panels, colour: diff.colour, ...(diff.swatch ? { swatch: diff.swatch } : {}) });
      return made.ok ? { ok: true, action: made.action } : made;
    }
    case "move-placement":
      return movement(spec, diff);
    case "swap-style": {
      if (!spec.kitPattern) return { ok: false, reason: "There is no pattern to swap yet. Say which colour the pattern should be." };
      return { ok: true, action: { type: "set-kit-pattern", kitPattern: { ...spec.kitPattern, style: diff.style, provenance: "ai-suggested" } } };
    }
    case "change-option":
      return { ok: true, action: { type: "set-option", optionId: diff.optionId, choiceId: diff.choiceId, provenance: "ai-suggested" } };
  }
}

/** Why the factory profile refuses this diff, or null. */
function profileReason(spec: GarmentSpec, diff: DesignDiff, profile: FactoryProfile): string | null {
  const blocker = profileFindings({ typeId: spec.typeId, readiness: null }, profile).find((found) => found.severity === "blocker");
  if (blocker) return blocker.message;
  // An empty list means the profile records no limit, not that nothing may change.
  if (diff.kind === "change-option" && profile.structuralOptions.length > 0 && !profile.structuralOptions.includes(diff.optionId)) {
    return `Profile "${profile.name}" does not list "${diff.optionId}" as something that can change.`;
  }
  return null;
}

/**
 * Applies a diff to a copy and says what changed. Nothing is saved. A diff the factory profile,
 * the garment or a guardrail blocker refuses comes back as a reason, never as a design.
 */
export function previewDiff(spec: GarmentSpec, diff: DesignDiff, profile: FactoryProfile, guardrails: GuardrailRun = () => []): Preview {
  const refused = profileReason(spec, diff, profile);
  if (refused) return fail(refused);
  const converted = convert(spec, diff);
  if (!converted.ok) return fail(converted.reason);
  const result = applyAction(spec, converted.action);
  if (!result.ok) return fail(result.reason);
  const said = [...explainChanges(spec, result.spec), ...(converted.extra ? [converted.extra] : [])];
  if (JSON.stringify(result.spec) === JSON.stringify(spec)) return fail("The design already has that.");
  const found = guardrails(result.spec);
  const blocker = found.find((note) => note.severity === "blocker");
  if (blocker) return fail(`That would break a print rule: ${blocker.message} Nothing was changed.`);
  const changes = converted.extra ? [converted.extra] : said;
  return { ok: true, after: result.spec, actions: [converted.action], changes, warnings: found.map((note) => note.message) };
}
