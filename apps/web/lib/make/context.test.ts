import { describe, expect, it } from "vitest";
import type { PromisedDate } from "@/lib/factory/dates";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { start } from "@/lib/garment/fixtures/specs";
import { annotateSamples, buildMakeContext, sampleSizesOf, summaryOf, toOrderProducts, type FactoryFacts, type MakeInput } from "./context";
import type { GoldenSampleView } from "./service";

const BASE = start("crew-tee");
const repainted = { ...BASE, colourways: [{ ...BASE.colourways[0], name: "Away" }] } as GarmentSpec;
const reshaped = { ...BASE, typeId: "v-neck-tee" } as GarmentSpec;

const NOT_SET: PromisedDate = { status: "not-set", startsAt: new Date("2026-11-02T07:00:00Z"), missing: ["the days for QC", "the freight days"] };

const factory: FactoryFacts = {
  profileId: "knitwright-default",
  madeBy: "Made by Knitwright · Sialkot",
  ladder: [],
  promised: NOT_SET,
  placeholder: true,
  fabricKeys: ["F-STK-TEE"],
  colourDeltaMax: 1.5,
  moq: null,
};

const sample = (over: Partial<GoldenSampleView> = {}): GoldenSampleView => ({
  id: "gs-1",
  productId: "p1",
  runId: "r1",
  designVersion: 1,
  version: 1,
  state: "approved",
  fitRating: 4,
  colourRating: 5,
  notes: "",
  factoryProfileId: "knitwright-default",
  approvedAt: "2026-11-02T10:00:00Z",
  closedAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  photos: [],
  poms: [],
  readings: [],
  carriedTo: [],
  ...over,
});

const input = (over: Partial<MakeInput> = {}): MakeInput => ({
  projectId: "pr1",
  designName: "Fern tee",
  garmentLabel: "Crew neck tee",
  currentVersion: 1,
  spec: BASE,
  product: { id: "p1", name: "Fern tee", stage: "idea", designVersion: 1 },
  articleCode: "TEE-TR-01",
  productionClass: "B",
  sizeRun: ["S", "M", "L"],
  sampleSize: "M",
  releases: [{ id: "rel1", number: 1, label: "Round 1", version: 1 }],
  goldenSamples: [],
  specsByVersion: new Map(),
  factory,
  currency: "GBP",
  ...over,
});

describe("the summary of the product-created page", () => {
  it("names the article, the fabric, the colourway and who makes it", () => {
    const lines = summaryOf(input());
    expect(lines.map((line) => line.label)).toEqual(["Design", "Article", "Production class", "Fabric", "Colourway", "Made by", "Design version"]);
    expect(lines.find((line) => line.label === "Made by")?.value).toContain("Sialkot");
    expect(lines.find((line) => line.label === "Colourway")?.value).toBe(BASE.colourways[0].name);
  });

  it("says the class and the article are not set rather than guessing them", () => {
    const lines = summaryOf(input({ articleCode: null, productionClass: null }));
    expect(lines.find((line) => line.label === "Production class")?.value).toContain("Not set");
    expect(lines.find((line) => line.label === "Article")?.value).toContain("no base article yet");
  });
});

describe("the sizes offered for a sample", () => {
  it("puts the base article's sample size first", () => {
    expect(sampleSizesOf(["S", "M", "L"], "M")).toEqual(["M", "S", "L"]);
  });
  it("leaves the run alone when there is no sample size, or it is not in the run", () => {
    expect(sampleSizesOf(["S", "M"], null)).toEqual(["S", "M"]);
    expect(sampleSizesOf(["S", "M"], "XL")).toEqual(["S", "M"]);
  });
});

describe("comparing a golden sample's version with the one being made", () => {
  it("leaves the sample of the very version uncompared", () => {
    const [annotated] = annotateSamples([sample()], 1, new Map(), BASE);
    expect(annotated!.changedSince).toBeNull();
  });

  it("compares a parent version's saved design with the one being made", () => {
    const [surface] = annotateSamples([sample()], 2, new Map([[1, BASE]]), repainted);
    expect(surface!.changedSince).toEqual([{ field: "colourways", group: "surface" }]);
    const [structural] = annotateSamples([sample()], 2, new Map([[1, BASE]]), reshaped);
    expect(structural!.changedSince).toEqual([{ field: "typeId", group: "structural" }]);
  });

  it("leaves a version whose design cannot be read uncompared, which blocks a run", () => {
    const [annotated] = annotateSamples([sample()], 2, new Map(), repainted);
    expect(annotated!.changedSince).toBeNull();
  });

  it("uses the carry-over already recorded, where there is one", () => {
    const carried = sample({ carriedTo: [{ toVersion: 2, changed: [{ field: "artwork", group: "surface" }] }] });
    const [annotated] = annotateSamples([carried], 2, new Map(), reshaped);
    expect(annotated!.changedSince).toEqual([{ field: "artwork", group: "surface" }]);
  });

  it("keeps a group the database does not know as structural", () => {
    const carried = sample({ carriedTo: [{ toVersion: 2, changed: [{ field: "artwork", group: "something-else" }] }] });
    const [annotated] = annotateSamples([carried], 2, new Map(), BASE);
    expect(annotated!.changedSince).toEqual([{ field: "artwork", group: "structural" }]);
  });
});

describe("the whole context", () => {
  it("blocks a run while no golden sample is signed off, and shows no price or date it does not have", () => {
    const context = buildMakeContext(input());
    expect(context.gate.status).toBe("blocked");
    expect(context.prices.every((step) => step.label === null)).toBe(true);
    expect(context.delivery.status).toBe("not-set");
    expect(context.delivery.note).not.toBe("");
    expect(context.sampleSizes[0]).toBe("M");
  });

  it("opens the run gate once a golden sample of the version is signed off", () => {
    const context = buildMakeContext(input({ goldenSamples: [sample()] }));
    expect(context.gate.status).toBe("ready");
  });

  it("carries a sign-off forward to a version that differs only on the surface", () => {
    const context = buildMakeContext(input({ currentVersion: 2, spec: repainted, specsByVersion: new Map([[1, BASE]]), goldenSamples: [sample()] }));
    expect(context.gate.status).toBe("ready");
    expect(context.gate.status === "ready" && context.gate.carriedOver).toBe(true);
  });

  it("holds the gate shut when the later version changed something structural", () => {
    const context = buildMakeContext(input({ currentVersion: 2, spec: reshaped, specsByVersion: new Map([[1, BASE]]), goldenSamples: [sample()] }));
    expect(context.gate.status).toBe("blocked");
  });
});

describe("the products of the order modal", () => {
  it("takes the date only where the factory data gives one", () => {
    const common = { productId: "p1", projectId: "pj1", name: "Fern tee", articleCode: "TEE-TR-01", productionClass: "B" as const, sizes: ["M"], ladder: [], madeBy: "Made by Knitwright · Sialkot", colourway: "Home" };
    const set: PromisedDate = { status: "set", startsAt: new Date("2026-11-02T07:00:00Z"), readyForQcOn: "2026-11-12", shipsOn: "2026-11-14", promisedOn: "2026-11-21" };
    expect(toOrderProducts([{ ...common, promised: NOT_SET }])[0]!.readyBy).toBeNull();
    expect(toOrderProducts([{ ...common, promised: set }])[0]!.readyBy).toBe("2026-11-21");
  });
});
