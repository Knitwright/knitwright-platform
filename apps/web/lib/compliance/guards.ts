import { blocker, GAP_RULE_ID, listOf, RULE_PFAS, warning, type ComplianceFinding } from "./model";

/**
 * The three F-G3 guardrails that stop a garment reaching a destination at all, as against the label wording,
 * which `labels.ts` builds: PFAS-free finishes only, the United States and children's sizes blocked until
 * CPSIA testing exists, and a market the platform does not sell into.
 *
 * "Blocked until CPSIA testing exists" is taken at its word. Nothing in the platform holds a CPSIA test
 * certificate, so `cpsiaCertificate` is null everywhere today and both halves of that rule refuse. That is
 * the state of the world, not a guess: the alternative would be to let a children's garment through on the
 * assumption that someone had tested it.
 */

/** What the platform knows about the fabric a garment is made from (X6 `programme_fabrics`). */
export interface FabricFacts {
  readonly code: string;
  readonly name: string;
  /** The blend as the fabric row states it, such as "100% polyester". Null: not recorded. */
  readonly blend: string | null;
  /** Null: no mill has declared it either way, which is not the same as "not PFAS-free". */
  readonly pfasFree: boolean | null;
  /** The certificate number. Null: this fabric has none, and no label may claim one. */
  readonly oekoTexCert: string | null;
}

/** Who the garment is for, as the design object records it (`lib/garment` WEARERS). */
export type Wearer = "men" | "women" | "youth";

export interface DestinationGuardInput {
  /** ISO 3166 alpha-2, or EU. */
  readonly country: string;
  readonly countryName: string;
  /** False: the platform does not sell into this market (X6 `country_rules.selling_enabled`). */
  readonly sellingEnabled: boolean;
  /** True where the market needs CPSIA testing first. Null: nobody has recorded whether it does. */
  readonly cpsiaRequired: boolean | null;
  readonly wearer: Wearer;
  /** The reference of a CPSIA test certificate on file. Null everywhere today. */
  readonly cpsiaCertificate: string | null;
  readonly fabric: FabricFacts | null;
  /** The rulebook entry on the market's row. */
  readonly ruleId: string;
}

const path = (country: string, part: string): string => `labels.${country.toLowerCase()}.${part}`;

/** PFAS-free finishes only (R-LAB-003). A fabric nobody has declared is refused, not assumed clean. */
export function pfasFindings(input: DestinationGuardInput): readonly ComplianceFinding[] {
  const { fabric } = input;
  if (fabric === null) {
    return [blocker("fabric_not_chosen", path(input.country, "fabric"), "No fabric is chosen, so its finish cannot be checked.", RULE_PFAS)];
  }
  if (fabric.pfasFree === true) return [];
  const because =
    fabric.pfasFree === false
      ? `${fabric.name} (${fabric.code}) is recorded as not PFAS-free, and Knitwright makes nothing with a PFAS finish.`
      : `No mill has declared ${fabric.name} (${fabric.code}) PFAS-free. Ask the mill for a PFAS-free declaration before this is made.`;
  return [blocker("pfas_not_declared", path(input.country, "fabric"), because, RULE_PFAS)];
}

/**
 * The United States and children's sizes, blocked until CPSIA testing exists (spec F-G3). A market whose row
 * does not say whether CPSIA applies is a gap, not a pass: the platform has nobody's word either way.
 */
export function cpsiaFindings(input: DestinationGuardInput): readonly ComplianceFinding[] {
  const at = path(input.country, "cpsia");
  const tested = input.cpsiaCertificate !== null;
  const found: ComplianceFinding[] = [];
  if (input.cpsiaRequired === null) {
    found.push(
      warning("cpsia_not_recorded", at, `Nobody has recorded whether ${input.countryName} needs CPSIA testing before a sale.`, GAP_RULE_ID),
    );
  }
  if (input.cpsiaRequired === true && !tested) {
    found.push(blocker("cpsia_required", at, `${input.countryName} needs CPSIA testing and no test certificate is on file.`, GAP_RULE_ID));
  }
  if (input.wearer === "youth" && !tested) {
    found.push(
      blocker(
        "cpsia_childrens_sizes",
        at,
        "This is made for youth sizes, which need CPSIA testing wherever they are sold, and no test certificate is on file.",
        GAP_RULE_ID,
      ),
    );
  }
  return found;
}

/** A market the platform does not sell into yet. The label is built either way; the hand-off is refused. */
export function marketFindings(input: DestinationGuardInput): readonly ComplianceFinding[] {
  return input.sellingEnabled
    ? []
    : [blocker("market_closed", path(input.country, "market"), `${input.countryName} is not a market Knitwright sells into yet.`, input.ruleId)];
}

/**
 * The OEKO-TEX line, and only where that fabric actually has one (F-G3: "OEKO-TEX Standard 100 fabrics where
 * available"). A fabric with no certificate gets no line and no finding: the spec asks for the certified
 * fabric to be used where it exists, and claiming a certificate a fabric does not hold would be the one
 * mistake that matters here.
 */
export const oekoTexCertificate = (fabric: FabricFacts | null): string | null => fabric?.oekoTexCert ?? null;

/** Every guardrail for one destination, in a fixed order. */
export const destinationGuards = (input: DestinationGuardInput): readonly ComplianceFinding[] => [
  ...marketFindings(input),
  ...pfasFindings(input),
  ...cpsiaFindings(input),
];

/** The one sentence a screen shows when a destination is refused, or null when nothing refuses it. */
export function whyDestinationRefused(findings: readonly ComplianceFinding[]): string | null {
  const stopped = findings.filter((found) => found.severity === "blocker");
  return stopped.length === 0 ? null : listOf(stopped.map((found) => found.message));
}
