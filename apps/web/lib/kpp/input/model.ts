import type { BaseArticle } from "@/lib/catalogue";
import type { DesignObjectV2 } from "@/lib/design-object";
import type { Capability, CountryRule, FabricColour, Factory, ProgrammeFabric } from "@/lib/factory/schemas";
import type { GuardrailSettings } from "@/lib/guardrails";
import type { KppInput, KppNameNumber, KppOrder } from "../model";

/**
 * The rows a production package is built from (plan v5 X5b item 1, decision 0070 revision 2). Every field is
 * something the platform already stores: the base article catalogue (X1, decision 0066), the design object and its
 * provenance (X4, decision 0069) and the factory, fabric, colour and price rows (X6, decision 0071). The builder
 * turns them into a `KppInput`; it reads no database and no clock, so a test builds the whole thing.
 *
 * Nothing here is guessed. A value no row holds becomes a field whose provenance is `needs_input`, and the F-G2
 * gate then refuses the package and names it (decision 18: a missing tolerance is a question for the factory, not
 * a guess). `KppUnsourced` is the list of such values, so a caller that has them can pass them in with their label.
 */

/** Who is taking the package and what the design version is, as the design's own rows hold it. */
export interface DesignFacts {
  /** The style code; it names the package folder and the download. */
  readonly code: string;
  readonly name: string;
  readonly version: number;
  /** sha256 of the design version, as the credits gate and the manifest name it. */
  readonly hash: string;
  /** When the version was saved. Every PDF date and ZIP entry time is pinned to it. */
  readonly createdAtIso: string;
  readonly brand: string;
  readonly season: string | null;
}

/**
 * What one garment consumes, for one bill-of-materials line. NO TABLE HOLDS THIS YET: the launch articles'
 * consumption lives only in `docs/spec/articles/<code>/article.json`, which X1 did not seed, and a consumption is a
 * measurement, so it is never invented here. Empty means every BOM line comes out with no quantity and the gate
 * refuses the package.
 */
export interface ConsumptionRow {
  /** The BOM item this is for, as `materials.ts` names it (`fabric:F-POLY-INT`, `thread:needle`, …). */
  readonly itemId: string;
  readonly qtyPerPiece: string;
  readonly unit: string;
  readonly sizeDependent: boolean;
  /** Where the number came from, in words, for the decision record and the README. */
  readonly label: string;
  readonly ruleId: string;
}

/**
 * The care-label wording of one destination market. `country_rules.label_rules` is the column that holds this, and
 * X6 seeded it as `{}` with a note saying the wording is still to be written, so today every market comes out
 * `needs_input` and the gate names it.
 */
export interface LabelWordingRow {
  /** An ISO country code, as `country_rules` holds it. */
  readonly country: string;
  readonly fibre: string | null;
  readonly care: readonly string[];
  readonly origin: string | null;
  readonly size: string | null;
  readonly importer: string | null;
  readonly importerRequired: boolean;
}

/** The quality plan of docs/spec/04's `09_qc`. No table holds it; owner decision 19 settles the sampling line. */
export interface QualityPlan {
  /** The AQL plan for a run. Owner decision 19: a Knitwright-made Class A sample inspects every piece instead. */
  readonly aqlPlan: string | null;
  /** POM letters to measure. Empty means the gate has nothing to show and the checklist says so. */
  readonly measure: readonly string[];
  readonly visual: readonly string[];
  readonly photos: readonly string[];
}

/**
 * Everything docs/spec/04 asks for that no table in the platform holds yet. Each one is a question for the factory
 * or the colour house, so each arrives here as data with a label, and nothing fills any of it in today.
 */
export interface KppUnsourced {
  readonly consumption: readonly ConsumptionRow[];
  readonly labelWording: readonly LabelWordingRow[];
  readonly quality: QualityPlan;
  /** Fold, bag and carton lines for a batch's job sheet. */
  readonly packing: readonly string[];
}

/** Nothing supplied: what the server passes today, so the gate names every gap. */
export const NOTHING_UNSOURCED: KppUnsourced = { consumption: [], labelWording: [], quality: { aqlPlan: null, measure: [], visual: [], photos: [] }, packing: [] };

export interface KppRows {
  readonly kind: KppInput["kind"];
  readonly design: DesignFacts;
  /** The design as the spec's design object (X4): its colourway, options, parameters and fabric. */
  readonly object: DesignObjectV2;
  /** The base article with its POMs, parameters, options, construction and fabrics (X1). */
  readonly article: BaseArticle;
  readonly factory: Factory;
  /** What this factory makes of this article in this fabric (X6). Null when it does not make it. */
  readonly capability: Capability | null;
  /** The programme fabric rows for every code the article allows, in any order (X6). */
  readonly fabrics: readonly ProgrammeFabric[];
  /** The programme's colours for the chosen fabric, for a swatch reference. */
  readonly fabricColours: readonly FabricColour[];
  /** The destination markets, as country rules, in the order the labels are wanted. */
  readonly markets: readonly CountryRule[];
  /** The print thresholds in force (lib/guardrails, overridable by a print house in lib/settings). */
  readonly print: GuardrailSettings;
  readonly moderation: KppInput["moderation"];
  /** The promised date, as X6's `promisedDate` worked it out. Null when no date is promised yet. */
  readonly dueDate: string | null;
  /** True when Knitwright makes this order, so the package is free (spec decision 9, owner decision 20). */
  readonly madeByKnitwright: boolean;
  readonly orders: readonly KppOrder[];
  readonly personalisation: readonly KppNameNumber[];
  readonly unsourced: KppUnsourced;
}

/** The programme fabric the design is made in, or null when the programme has no row for its code. */
export const chosenFabric = (rows: KppRows): ProgrammeFabric | null => rows.fabrics.find((fabric) => fabric.code === rows.object.article.fabric.code) ?? null;
