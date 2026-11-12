import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarmentSpec } from "@/lib/garment";
import { AppError } from "@/lib/server/core/errors";
import type { ValidationCheck } from "./check";
import type { ValidationPorts } from "./ports";
import { writeValidationResult } from "./results";
import { loadFactoryProfile } from "./service";
import { specInput, standardRegistry } from "./spec-input";
import { validateDesign, type ValidationResult } from "./validate";

/**
 * THE VALIDATION GATE ON ORDERING AND RELEASING (plan v6 D1, decision 0132; spec F-0: validation "blocks ordering
 * or export on any `error`").
 *
 * `ValidationResult.orderable` used to be read in one place only, to grey out a button in the Factory file panel.
 * Nothing that actually sends work anywhere looked at it: a sample, a run, a brand run and a release all went
 * ahead whatever the checks said. Every one of those paths now calls `assertOrderable` first.
 *
 * The checks run here are the ones every save runs (`on-save.ts`): the factory profile, the five guardrails,
 * parameters in range and moderation clear. The tech pack's readiness list is not among them; at an order it
 * is read through the F-G2 checklist instead (`lib/make/order-checks.ts`), so the two do not count one gap twice.
 *
 * They are run again rather than read back, and stored as the version's newest `save` result. That is what
 * the database's own gate in `submit_order_for_production` reads (migration 20261220010000), so the app and
 * the database decide on the same result, written a moment apart, and a rulebook change since the save counts.
 */

/** The failed checks that stop an order: every one of severity `blocker`. */
export const blockersOf = (checks: readonly ValidationCheck[]): readonly ValidationCheck[] =>
  checks.filter((check) => !check.passed && check.severity === "blocker");

const MOST_NAMED = 3;

/** The refusal a person reads, naming the first few blockers; null when nothing blocks. */
export function whyNotOrderable(checks: readonly ValidationCheck[]): string | null {
  const blockers = blockersOf(checks);
  if (blockers.length === 0) return null;
  const named = blockers.slice(0, MOST_NAMED).map((check) => check.message.replace(/\.?$/, "."));
  const more = blockers.length > MOST_NAMED ? ` And ${blockers.length - MOST_NAMED} more.` : "";
  const count = `${blockers.length} ${blockers.length === 1 ? "blocker" : "blockers"}`;
  return `This design has ${count} against the factory profile: ${named.join(" ")}${more} Clear them in the Factory file first.`;
}

export interface VersionToCheck {
  readonly projectId: string;
  readonly version: number;
  readonly spec: GarmentSpec;
}

type Deps = Readonly<{ admin: SupabaseClient; ports: ValidationPorts }>;
type Who = Readonly<{ brandId: string; userId: string }>;

/** Runs the save checks on one version and stores them as its newest result. Throws if they cannot be stored. */
export async function checkVersion(deps: Deps, who: Who, target: VersionToCheck): Promise<ValidationResult & { readonly profileId: string }> {
  const [profile, extra] = await Promise.all([loadFactoryProfile(deps.admin), specInput(target.spec, who.brandId, deps.ports)]);
  const result = validateDesign({ typeId: target.spec.typeId, readiness: null, ...extra }, profile, standardRegistry());
  await writeValidationResult(deps.admin, who, { projectId: target.projectId, version: target.version, profileId: profile.id, scope: "save", checks: result.checks });
  return { ...result, profileId: profile.id };
}

/** Refuses, in plain words, a version whose checks hold a blocker. Returns the result when nothing blocks. */
export async function assertOrderable(deps: Deps, who: Who, target: VersionToCheck): Promise<ValidationResult> {
  const result = await checkVersion(deps, who, target);
  const why = whyNotOrderable(result.checks);
  if (why !== null) throw new AppError("conflict", why);
  return result;
}
