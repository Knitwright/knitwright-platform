import type { OutputKind } from "@/lib/credits/kinds";
import { buildPackage, KPP_GENERATOR_VERSION, type ManifestEntry } from "./assemble";
import { sha256Hex } from "./encode";
import { checkPackage, type GateIssue } from "./gate";
import type { KppInput, KppSources } from "./model";
import { packageRoot, safePart } from "./paths";

/**
 * Exporting a production package: the credits decision, the download name and the record of what
 * was built (decision 0070).
 *
 * The package is free when Knitwright makes the order and paid when a brand takes the files
 * elsewhere (docs/spec/02-features.md F-S6, spec decision 9, plan v5 owner decision 20 — which is
 * money, so the owner may overturn it, and the price in `lib/credits/settings.ts` is a labelled
 * placeholder, never a quoted price). The charge goes through `ChargeForPackage`, which
 * `lib/kpp/server.ts` wires to the credits gate; `freeCharge` is the stand-in the tests use.
 */

/** The credit kind this output is charged under (`lib/credits/kinds.ts`). */
export const PACKAGE_OUTPUT_KIND = "production_package" satisfies OutputKind;

export type ChargeDecision = Readonly<{ charge: false; why: string }> | Readonly<{ charge: true; kind: typeof PACKAGE_OUTPUT_KIND }>;

/**
 * Whether this package costs credits. Free when Knitwright makes the garment, and free for a
 * batch, which is Knitwright's own production run and not a file a brand takes away.
 */
export function chargeDecision(input: KppInput): ChargeDecision {
  if (input.kind === "batch") return { charge: false, why: "A production batch is Knitwright's own run, not an export." };
  if (input.factory.madeByKnitwright) return { charge: false, why: "Knitwright makes this order, so the package is included." };
  return { charge: true, kind: PACKAGE_OUTPUT_KIND };
}

/** The charge, as the route will make it. Returns a refusal sentence, or null when the work may go ahead. */
export interface ChargeForPackage {
  charge(decision: ChargeDecision, input: KppInput): Promise<string | null>;
}

/** The stand-in while nothing is gated: it charges nothing and refuses nothing. */
export const freeCharge: ChargeForPackage = { charge: async () => null };

/** What was built, for a `package_exports` row once one exists (none is written yet). */
export type PackageRecord = Readonly<{
  root: string;
  fileName: string;
  designCode: string;
  designVersion: number;
  designHash: string;
  factoryCode: string;
  kind: KppInput["kind"];
  generatorVersion: string;
  /** sha256 of the ZIP. The same version and factory always give the same one. */
  zipSha256: string;
  zipBytes: number;
  fileCount: number;
  builtFor: string;
}>;

export type ExportResult =
  | Readonly<{ ok: true; zip: Uint8Array; record: PackageRecord; files: readonly ManifestEntry[] }>
  | Readonly<{ ok: false; reason: "blocked"; issues: readonly GateIssue[] }>
  | Readonly<{ ok: false; reason: "refused"; message: string }>;

/** `KPP_<design>_v<n>_<factory>.zip`, the plain-ASCII name a browser saves under. */
export const packageFileName = (input: KppInput): string =>
  `${packageRoot(safePart(input.design.code, "design"), input.design.version, input.factory.code)}${input.kind === "batch" ? "_batch" : ""}.zip`;

/** What a route asks the credits gate to charge for: the kind, or null when this package is free. */
export const packageCreditKind = (input: KppInput): OutputKind | null => {
  const decision = chargeDecision(input);
  return decision.charge ? decision.kind : null;
};

/**
 * Builds a package for download: checks it, charges, then builds.
 *
 * The F-G2 check comes first and costs nothing, so a package that cannot be built is never
 * charged for — a brand should not pay to be told what the factory still has to answer. The
 * charge then comes before the work, as decision 0051 requires, so a short balance stops a long
 * build; `buildPackage` checks again, which is cheap and deterministic.
 */
export async function exportPackage(input: KppInput, sources: KppSources, charge: ChargeForPackage = freeCharge): Promise<ExportResult> {
  const blocked = checkPackage(input);
  if (blocked.length > 0) return { ok: false, reason: "blocked", issues: blocked };
  const decision = chargeDecision(input);
  const refusal = await charge.charge(decision, input);
  if (refusal !== null) return { ok: false, reason: "refused", message: refusal };
  const built = await buildPackage(input, sources);
  if (!built.ok) return { ok: false, reason: "blocked", issues: built.issues };
  return {
    ok: true,
    zip: built.zip,
    files: built.files,
    record: {
      root: built.root,
      fileName: packageFileName(input),
      designCode: input.design.code,
      designVersion: input.design.version,
      designHash: input.design.hash,
      factoryCode: input.factory.code,
      kind: input.kind,
      generatorVersion: KPP_GENERATOR_VERSION,
      zipSha256: sha256Hex(built.zip),
      zipBytes: built.zip.length,
      fileCount: built.files.length,
      builtFor: input.design.createdAtIso,
    },
  };
}
