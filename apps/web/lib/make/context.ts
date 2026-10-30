import type { PromisedDate } from "@/lib/factory/dates";
import type { Ladder } from "@/lib/factory/pricing";
import type { SellCurrency } from "@/lib/factory/schemas";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { deliveryLine, type DeliveryLine } from "./delivery";
import { runGate, type RunGate, type SignedOffSample } from "./gate";
import { priceSteps, type PriceStep } from "./prices";
import type { RunClass } from "./run";
import type { GoldenSampleView } from "./service";
import { compareVersions } from "./surface";
import type { OrderProduct } from "./order-modal";

/**
 * What the make pages show, assembled from rows that are already read (plan v5 Y7, decision 0080). Everything
 * here is pure, so the sums and the sentences are tested without a database; `server.ts` does the reading.
 *
 * Nothing is filled in for a factory. A price comes from the tiers or says it is not on file; a date comes from
 * `promisedDate` or says what part of it is missing; a production class comes from the base article or is "not set".
 */

export interface FactoryFacts {
  /** The id the order is handed over with, from the factory profile the platform already uses. */
  readonly profileId: string;
  /** "Made by Knitwright · Sialkot": the factory's own name and city. */
  readonly madeBy: string;
  readonly ladder: Ladder;
  readonly promised: PromisedDate;
  /** True while the cut-off and QC days are Knitwright's placeholders. */
  readonly placeholder: boolean;
  readonly fabricKeys: readonly string[];
  readonly colourDeltaMax: number | null;
  readonly moq: number | null;
}

export interface ProductRef {
  readonly id: string;
  readonly name: string;
  readonly stage: "idea" | "sample" | "run";
  readonly designVersion: number;
}

export interface ReleaseRef {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  /** The design version the release froze, where the snapshot says. */
  readonly version: number | null;
}

export interface MakeInput {
  readonly projectId: string;
  readonly designName: string;
  readonly garmentLabel: string;
  readonly currentVersion: number;
  readonly spec: GarmentSpec;
  /** Null until the design is listed as a product. */
  readonly product: ProductRef | null;
  readonly articleCode: string | null;
  readonly productionClass: RunClass;
  readonly sizeRun: readonly string[];
  readonly sampleSize: string | null;
  readonly releases: readonly ReleaseRef[];
  readonly goldenSamples: readonly GoldenSampleView[];
  /** The design as it was saved at each version a golden sample was cut from. */
  readonly specsByVersion: ReadonlyMap<number, GarmentSpec>;
  readonly factory: FactoryFacts;
  readonly currency: SellCurrency;
}

export interface MakeContext extends Omit<MakeInput, "spec" | "specsByVersion"> {
  readonly summary: readonly Readonly<{ label: string; value: string }>[];
  readonly prices: readonly PriceStep[];
  readonly delivery: DeliveryLine;
  readonly gate: RunGate;
  /** The sizes a sample may be asked for: the design's size run, the sample size first. */
  readonly sampleSizes: readonly string[];
  /** The fabric an order is made in: the factory's own code for the article, or the design's own fabric. */
  readonly fabricKey: string;
}

/**
 * Each golden sample with how the version being made differs from the one it was cut from. A version whose saved
 * design could not be read is left uncompared, which blocks a run: an unknown difference is never a surface one.
 */
export function annotateSamples(
  samples: readonly GoldenSampleView[],
  version: number,
  specsByVersion: ReadonlyMap<number, GarmentSpec>,
  current: GarmentSpec,
): readonly SignedOffSample[] {
  return samples.map((sample) => {
    const was = specsByVersion.get(sample.designVersion);
    const carried = sample.carriedTo.find((one) => one.toVersion === version);
    const changed = carried
      ? carried.changed.map((one) => ({ field: one.field, group: one.group === "surface" ? ("surface" as const) : ("structural" as const) }))
      : sample.designVersion === version || was === undefined
        ? null
        : compareVersions(was, current).changed;
    return { id: sample.id, designVersion: sample.designVersion, state: sample.state, approvedAt: sample.approvedAt, changedSince: changed };
  });
}

const fabricOf = (spec: GarmentSpec): string => spec.fabrics[0]?.name ?? "Not chosen yet";
const colourwayOf = (spec: GarmentSpec): string => spec.colourways[0]?.name ?? "Not named yet";

/** The left-hand summary of the product-created page: the article, the fabric and the colourway (F-S7). */
export function summaryOf(input: MakeInput): readonly Readonly<{ label: string; value: string }>[] {
  return [
    { label: "Design", value: input.designName },
    { label: "Article", value: input.articleCode ?? `${input.garmentLabel} · no base article yet` },
    { label: "Production class", value: input.productionClass === null ? "Not set: no base article covers this garment type" : input.productionClass },
    { label: "Fabric", value: fabricOf(input.spec) },
    { label: "Colourway", value: colourwayOf(input.spec) },
    { label: "Made by", value: input.factory.madeBy },
    { label: "Design version", value: String(input.currentVersion) },
  ];
}

/** The size run with the base article's sample size first, because that is the one a sample is cut in. */
export function sampleSizesOf(sizeRun: readonly string[], sampleSize: string | null): readonly string[] {
  if (sampleSize === null || !sizeRun.includes(sampleSize)) return sizeRun;
  return [sampleSize, ...sizeRun.filter((size) => size !== sampleSize)];
}

export function buildMakeContext(input: MakeInput): MakeContext {
  const { spec, specsByVersion, ...rest } = input;
  return {
    ...rest,
    summary: summaryOf(input),
    prices: priceSteps(input.factory.ladder, input.currency),
    delivery: deliveryLine({ date: input.factory.promised, placeholder: input.factory.placeholder }),
    gate: runGate(input.currentVersion, annotateSamples(input.goldenSamples, input.currentVersion, specsByVersion, spec)),
    sampleSizes: sampleSizesOf(input.sizeRun, input.sampleSize),
    fabricKey: input.factory.fabricKeys[0] ?? spec.fabrics[0]?.name ?? "",
  };
}

export interface OrderProductInput {
  readonly productId: string;
  readonly projectId: string;
  readonly name: string;
  readonly articleCode: string | null;
  readonly productionClass: RunClass;
  readonly sizes: readonly string[];
  readonly ladder: Ladder;
  readonly promised: PromisedDate;
  readonly madeBy: string;
  readonly colourway: string;
}

/** The rows of the order modal: a product with the date its own factory data gives, or none. */
export const toOrderProducts = (products: readonly OrderProductInput[]): readonly OrderProduct[] =>
  products.map(({ promised, ...product }) => ({ ...product, readyBy: promised.status === "set" ? promised.promisedOn : null }));
