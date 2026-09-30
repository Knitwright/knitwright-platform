import { beforeAll, describe, expect, it } from "vitest";
import type { ChartMapping } from "@/lib/charts/mapping";
import { importChart, uploadChartFile } from "@/lib/charts/service";
import { getType } from "@/lib/garment";
import { createProject, saveAction } from "@/lib/projects/service";
import { loadTechPackSource } from "@/lib/projects/tech-pack-load";
import { AppError } from "@/lib/server/core/errors";
import { pointsAlwaysApplying, type ChartSet } from "@/lib/sizing";
import { selectChart } from "@/lib/sizing/select-chart";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The one loader that the tech pack page and the export route both use, so that the screen and the
 * files are made from the same reads. It is tested against the real database.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("load-alice"), person("load-bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

const make = (): Promise<string> =>
  createProject(adminClient(), { brandId: aliceBrand, userId: alice.userId, name: "Home shirt", styleNumber: "HS-01", season: "SS27", typeId: "crew-tee", wearer: "women" });

const change = async (projectId: string, expectedVersion: number, choiceId: string) => {
  const outcome = await saveAction(adminClient(), alice.client, {
    brandId: aliceBrand,
    userId: alice.userId,
    projectId,
    expectedVersion,
    action: { type: "set-option", optionId: "fit", choiceId, provenance: "user-edited" },
  });
  if (!outcome.ok) throw new Error(outcome.reason);
};

const load = (projectId: string, options: { version?: number } = {}, who = alice, brandId = aliceBrand) =>
  loadTechPackSource(who.client, brandId, projectId, { shrink: shrinkForDrawing, ...options });

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("loading the inputs of a tech pack", () => {
  it("reads the current version, its history and its pictures", async () => {
    const id = await make();
    await change(id, 1, "slim");

    const source = await load(id);

    expect(source.project).toMatchObject({ id, name: "Home shirt", styleNumber: "HS-01", currentVersion: 2 });
    expect(source.project.spec.options["fit"]?.choiceId).toBe("slim");
    expect(source.history.versions.map((entry) => entry.version)).toEqual([2, 1]);
    expect(source.pictures).toEqual({ images: new Map(), skipped: 0 });
  });

  it("reads an older version of the design as the version it was, with the history up to it", async () => {
    const id = await make();
    await change(id, 1, "slim");

    const old = await load(id, { version: 1 });

    expect(old.project.currentVersion).toBe(1);
    expect(old.project.spec.options["fit"]?.choiceId).not.toBe("slim");
    expect(old.project.name).toBe("Home shirt");
  });

  it("says a version the design does not have is not found", async () => {
    const id = await make();

    expect((await failureOf(load(id, { version: 5 }))).code).toBe("not_found");
  });

  it("says a design of another brand is not found, as the page does", async () => {
    const id = await make();

    expect((await failureOf(load(id, {}, bob, bobBrand))).code).toBe("not_found");
    expect((await failureOf(load(id, { version: 1 }, bob, bobBrand))).code).toBe("not_found");
  });

  it("says a design that does not exist is not found", async () => {
    expect((await failureOf(load("6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11"))).code).toBe("not_found");
  });
});

/**
 * A brand's chart imported after a version was saved does not change that version. MADE-UP
 * NUMBERS FOR TESTS ONLY: every value below is invented and is not a garment measurement.
 */
describe("the size charts a version is shown with", () => {
  let carol: Person;
  let carolBrand: string;

  beforeAll(async () => {
    carol = await person("load-carol");
    carolBrand = await brandOf(carol, "Carol Cycling");
  });

  const chartFile = (sizes: readonly string[]): Uint8Array => {
    const type = getType("crew-tee");
    if (!type) throw new Error("No crew tee.");
    const lines = [`Point,${sizes.join(",")},Tol`];
    pointsAlwaysApplying(type).forEach((point, index) => {
      lines.push([point.label, ...sizes.map((_, step) => String(30 + index + step)), "1"].join(","));
    });
    return new TextEncoder().encode(lines.join("\n"));
  };

  const importSizes = async (sizes: readonly string[]): Promise<void> => {
    const who = { brandId: carolBrand, userId: carol.userId };
    const { fileId } = await uploadChartFile(adminClient(), who, chartFile(sizes));
    const mapping: ChartMapping = {
      wearer: "men",
      garmentType: "crew-tee",
      fit: null,
      headerLine: 1,
      pointColumn: 0,
      units: "cm",
      unitsColumn: null,
      sizeColumns: sizes.map((_, index) => index + 1),
      toleranceColumn: sizes.length + 1,
      baseSize: "M",
      person: "Test Person",
      rowPoints: [],
    };
    await importChart(adminClient(), createFileReader(carol.client, carolBrand), { ...who, fileId, mapping, today: "2026-09-30" });
  };

  const sizesIn = (charts: ChartSet, spec: Parameters<typeof selectChart>[1]): readonly string[] => {
    const choice = selectChart(charts, spec);
    return choice.kind === "none" ? [] : choice.run.sizes;
  };

  it("keeps an old version on the charts it was saved with, and shows the current one with today's", async () => {
    await importSizes(["S", "M", "L"]);
    const id = await createProject(adminClient(), {
      brandId: carolBrand,
      userId: carol.userId,
      name: "Club tee",
      styleNumber: "CT-01",
      season: "SS27",
      typeId: "crew-tee",
      wearer: "men",
    });
    await importSizes(["XS", "S", "M", "L", "XL"]);
    const outcome = await saveAction(adminClient(), carol.client, {
      brandId: carolBrand,
      userId: carol.userId,
      projectId: id,
      expectedVersion: 1,
      action: { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" },
    });
    if (!outcome.ok) throw new Error(outcome.reason);

    const old = await load(id, { version: 1 }, carol, carolBrand);
    const current = await load(id, {}, carol, carolBrand);
    const named = await load(id, { version: 2 }, carol, carolBrand);

    expect(sizesIn(old.charts, old.project.spec)).toEqual(["S", "M", "L"]);
    expect(sizesIn(current.charts, current.project.spec)).toEqual(["XS", "S", "M", "L", "XL"]);
    expect(sizesIn(named.charts, named.project.spec)).toEqual(["XS", "S", "M", "L", "XL"]);
  });

  it("keeps the replaced chart as superseded, with one current chart", async () => {
    const rows = must(
      await adminClient().from("brand_size_charts").select("superseded_at, imported_at").eq("brand_id", carolBrand).order("imported_at"),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.superseded_at).not.toBeNull();
    expect(rows[1]?.superseded_at).toBeNull();
  });
});
