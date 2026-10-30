import { designVersionHash } from "@/lib/credits/version-hash";
import type { CountryRule } from "@/lib/factory/schemas";
import { DEFAULT_SETTINGS, type GuardrailSettings } from "@/lib/guardrails";
import type { StoredPrintProfile } from "@/lib/print/profiles";
import type { ProjectSummary } from "@/lib/projects/service";
import type { ModerationStatus, ModerationTarget } from "@/lib/validation/ports";
import type { KppInput } from "../model";
import type { DesignFacts } from "../input/model";

/**
 * The few decisions the export route has to make while it gathers the rows a package is built from. They are
 * here, with tests, so `sources/server.ts` is only reads and a plain object (plan v5 X5, decision 0070 point 1:
 * the assembler reads no database, no environment and no clock).
 *
 * Nothing here invents a value. Where the platform holds none, the row goes in as the nothing it is and the
 * F-G2 gate (`lib/kpp/gate.ts`) refuses the package and names it.
 */

/** The design version a package is built from, hashed the way the credits gate hashes it. */
export function designFactsOf(project: Pick<ProjectSummary, "name" | "styleNumber" | "season" | "currentVersion"> & { readonly id: string; readonly versionSavedAt: string }, brandName: string): DesignFacts {
  return {
    code: project.styleNumber,
    name: project.name,
    version: project.currentVersion,
    hash: designVersionHash(project.id, project.currentVersion),
    // Every PDF date and every ZIP entry time is pinned to this, which is what makes the package deterministic.
    createdAtIso: project.versionSavedAt,
    brand: brandName,
    season: project.season.trim() === "" ? null : project.season,
  };
}

/**
 * The print thresholds in force, taken from the brand's own print profile so the numbers the package states and
 * the numbers its files are made at are one set of numbers. The safe zone is not part of a print profile, so it
 * stays the labelled guardrail default; nothing in the package reads it.
 */
export const printSettingsOf = (profile: StoredPrintProfile): GuardrailSettings => ({
  minDpi: { value: profile.minDpi, source: profile.source },
  bleedMm: { value: profile.bleedMm, source: profile.source },
  safeZoneMm: DEFAULT_SETTINGS.safeZoneMm,
});

/**
 * What the package says about moderation (F-G1, decision 0073), from the screenings moderation has kept for this
 * design's own assets and text.
 *
 * `flagged` and `pending` are what the gate refuses on, so neither is claimed loosely, and **`clear` is only said
 * when every target of the design has a kept screening**. A design with nothing to screen, or with a target
 * nobody has screened, is `not_built`: the package goes through and `00_README.pdf` says no check was made,
 * which is what decision 0070 point 4 settled. Saying "clear" for a design nobody screened would be the
 * settled-sounding claim the wording rules exist to stop.
 */
export function moderationOf(targets: readonly ModerationTarget[], statuses: readonly ModerationStatus[]): KppInput["moderation"] {
  const results = statuses.map((status) => status.result);
  if (results.includes("flagged") || results.includes("blocked")) return "flagged";
  if (results.includes("pending")) return "pending";
  return targets.length > 0 && statuses.length === targets.length ? "clear" : "not_built";
}

/** The destination markets a care label is written for: the countries selling is open in, in a fixed order. */
export const marketsOf = (rules: readonly CountryRule[]): readonly CountryRule[] =>
  [...rules].filter((rule) => rule.sellingEnabled).sort((a, b) => a.country.localeCompare(b.country));

/**
 * Whether Knitwright makes this order, which decides whether the package is free (spec decision 9, owner
 * decision 20). **No row says so.** `factories` holds a partner's name, city and certifications; nothing on it
 * or on a capability says who the order is placed by. So the route says `false` — the package is charged, which
 * is what owner decision 20 settled for a factory Knitwright does not own — and the package carries this
 * sentence rather than letting the answer pass unnoticed. It is an owner question, not a fact.
 */
export const MADE_BY_KNITWRIGHT = false;

export const MADE_BY_NOTE =
  "No row on file says who places this order, so this package is treated as a brand's own export of the files and is charged at a placeholder price the owner has not set. Knitwright's own orders and production batches are free (owner decision 20).";
