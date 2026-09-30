import { beforeAll, describe, expect, it } from "vitest";
import { createSpec, getType } from "@/lib/garment";
import type { ChartMapping } from "@/lib/charts/mapping";
import { brandChartSet, importChart, listBrandCharts, uploadChartFile } from "@/lib/charts/service";
import { AppError } from "@/lib/server/core/errors";
import { pointsAlwaysApplying, resolveMeasurements } from "@/lib/sizing";
import { createFileReader } from "@/lib/storage/read";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Plan step 25. A brand imports its own size chart from a file. MADE-UP NUMBERS FOR
 * TESTS ONLY: every value below is invented and is not a garment measurement.
 */

const points = (): readonly string[] => {
  const type = getType("crew-tee");
  if (!type) throw new Error("No crew tee.");
  return pointsAlwaysApplying(type).map((point) => point.label);
};

const csv = (sizes: readonly string[], skip?: string): Uint8Array => {
  const lines = [`Point,${sizes.join(",")},Tol`];
  points().forEach((label, index) => {
    if (label === skip) return;
    lines.push([label, ...sizes.map((_, step) => String(20 + index + step)), "1"].join(","));
  });
  return new TextEncoder().encode(lines.join("\n"));
};

const mapping = (sizeCount: number, baseSize: string): ChartMapping => ({
  wearer: "men",
  garmentType: "crew-tee",
  fit: null,
  headerLine: 1,
  pointColumn: 0,
  units: "cm",
  unitsColumn: null,
  sizeColumns: Array.from({ length: sizeCount }, (_, index) => index + 1),
  toleranceColumn: sizeCount + 1,
  baseSize,
  person: "Test Person",
  rowPoints: [],
});

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const upload = (owner: Person, brandId: string, bytes: Uint8Array) =>
  uploadChartFile(adminClient(), { brandId, userId: owner.userId }, bytes);

const run = (owner: Person, brandId: string, fileId: string, chosen: ChartMapping) =>
  importChart(adminClient(), createFileReader(owner.client, brandId), {
    brandId,
    userId: owner.userId,
    fileId,
    mapping: chosen,
    today: "2026-09-29",
  });

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("alice"), person("bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("uploading a chart file", () => {
  it("stores it through the upload helper as a chart file of the brand, and gives back its cells", async () => {
    const uploaded = await upload(alice, aliceBrand, csv(["S", "M", "L"]));
    expect(uploaded.grid[0]?.cells).toEqual(["Point", "S", "M", "L", "Tol"]);
    const [row] = must(await adminClient().from("files").select("*").eq("id", uploaded.fileId));
    expect(row).toMatchObject({ brand_id: aliceBrand, bucket: "uploads", kind: "chart", content_type: "text/csv" });
  });

  it("refuses a file that is not a chart and stores nothing", async () => {
    const before = must(await adminClient().from("files").select("id").eq("brand_id", bobBrand));
    const failure = await failureOf(upload(bob, bobBrand, new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2])));
    expect(failure.code).toBe("invalid_input");
    expect(must(await adminClient().from("files").select("id").eq("brand_id", bobBrand))).toHaveLength(before.length);
  });
});

describe("importing a chart", () => {
  it("replaces the brand's chart with a valid file, and its values are supplied by the brand", async () => {
    const first = await upload(alice, aliceBrand, csv(["S", "M", "L"]));
    await run(alice, aliceBrand, first.fileId, mapping(3, "M"));
    const second = await upload(alice, aliceBrand, csv(["XS", "S", "M", "L", "XL"]));
    const imported = await run(alice, aliceBrand, second.fileId, mapping(5, "M"));

    expect(imported.sizes).toEqual(["XS", "S", "M", "L", "XL"]);
    const charts = await listBrandCharts(alice.client, aliceBrand);
    expect(charts).toHaveLength(1);
    expect(charts[0]?.run.sizes).toEqual(["XS", "S", "M", "L", "XL"]);
    const rows = must(
      await adminClient().from("brand_size_charts").select("source_file_id").eq("brand_id", aliceBrand).is("superseded_at", null),
    );
    expect(rows).toEqual([{ source_file_id: second.fileId }]);
    // The chart it replaced is kept, so versions saved while it applied keep their sizes.
    const replaced = must(
      await adminClient().from("brand_size_charts").select("source_file_id").eq("brand_id", aliceBrand).not("superseded_at", "is", null),
    );
    expect(replaced).toEqual([{ source_file_id: first.fileId }]);

    const made = createSpec("crew-tee", "men");
    if (!made.ok) throw new Error(made.reason);
    const resolved = resolveMeasurements(made.spec, "XL", await brandChartSet(alice.client, aliceBrand));
    const setRows = resolved.rows.filter((row) => row.status === "set");
    expect(setRows).toHaveLength(points().length);
    for (const row of setRows) expect(row).toMatchObject({ provenance: "brand-supplied" });
  });

  it("refuses a file missing a point of measure, names it, and keeps the chart it had", async () => {
    const before = await listBrandCharts(alice.client, aliceBrand);
    const file = await upload(alice, aliceBrand, csv(["S", "M"], "Chest width"));
    const failure = await failureOf(run(alice, aliceBrand, file.fileId, mapping(2, "S")));
    expect(failure.code).toBe("invalid_input");
    expect(failure.message).toContain("Chest width");
    expect(failure.fields?.missing).toEqual(["Chest width"]);
    expect(await listBrandCharts(alice.client, aliceBrand)).toEqual(before);
  });

  it("lets nobody import another brand's file, or import into a brand they do not belong to", async () => {
    const alicesFile = await upload(alice, aliceBrand, csv(["S", "M"]));
    const readByBob = await failureOf(run(bob, bobBrand, alicesFile.fileId, mapping(2, "S")));
    expect(readByBob.code).toBe("not_found");

    const bobsFile = await upload(bob, bobBrand, csv(["S", "M"]));
    const intoAlices = await failureOf(
      importChart(adminClient(), createFileReader(bob.client, bobBrand), {
        brandId: aliceBrand,
        userId: bob.userId,
        fileId: bobsFile.fileId,
        mapping: mapping(2, "S"),
        today: "2026-09-29",
      }),
    );
    expect(intoAlices.code).toBe("not_found");
    expect(await listBrandCharts(bob.client, bobBrand)).toEqual([]);
  });

  it("lets a browser neither write a chart nor call the function that writes one", async () => {
    const direct = await alice.client.from("brand_size_charts").insert({
      brand_id: aliceBrand,
      wearer: "men",
      garment_type: "polo",
      fit: "any",
      chart: {},
      run: {},
      imported_by: alice.userId,
    });
    expect(direct.error).not.toBeNull();
    const called = await alice.client.rpc("replace_brand_chart", {
      p_brand_id: aliceBrand,
      p_user_id: alice.userId,
      p_wearer: "men",
      p_garment_type: "polo",
      p_fit: "any",
      p_chart: {},
      p_run: {},
      p_file_id: null,
    });
    expect(called.error).not.toBeNull();
  });

  it("does not show one brand's charts to another brand's member", async () => {
    const seen = must(await bob.client.from("brand_size_charts").select("id").eq("brand_id", aliceBrand));
    expect(seen).toEqual([]);
  });
});
