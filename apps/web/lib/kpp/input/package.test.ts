import { describe, expect, it } from "vitest";
import { readArticleJson } from "@/lib/catalogue/fixtures/source";
import { buildPackage } from "../assemble";
import { sha256Hex } from "../encode";
import { fixtureSources } from "../fixtures/jsy-ss-01";
import { FIXTURE_CONSUMPTION, FIXTURE_LABEL_WORDING, FIXTURE_UNSOURCED, fixtureRows } from "../fixtures/rows";
import { PATHS } from "../paths";
import { draftedPattern } from "../sources/pattern";
import { buildKppInput } from "./build";

/**
 * The whole production package, built from the rows the platform really holds: X1's catalogue, X4's design object,
 * X6's factory and fabric rows, and X3's graded drafter for the pattern (decision 0070 revision 1). This is
 * plan v5 X5b's "done when": one article in seven sizes, built, deterministic, and refused when a point of measure
 * has no tolerance.
 */

const drafted = () => {
  const outcome = draftedPattern("JSY-SS-01");
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome;
};

const sources = () => fixtureSources({ pattern: drafted().source });

describe("a package built from real catalogue rows", () => {
  it("builds for one article in seven sizes, with every path docs/spec/04 lists", async () => {
    const input = buildKppInput(fixtureRows());

    const built = await buildPackage(input, sources());

    if (!built.ok) throw new Error(built.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    expect(input.design.sizes).toHaveLength(7);
    const paths = built.files.map((file) => file.path);
    // The manifest lists every other file, so it is not in its own list.
    for (const path of [PATHS.readme, PATHS.techpackPdf, PATHS.techpackJson, PATHS.pom, PATHS.sizeChart, PATHS.bom, PATHS.colourPdf, PATHS.colourJson, PATHS.qc, PATHS.renders]) {
      expect(paths, path).toContain(path);
    }
    for (const size of input.design.sizes) {
      expect(paths.some((path) => path.endsWith(`dxf_aama/JSY-SS-01_${size}.dxf`)), size).toBe(true);
      expect(paths.some((path) => path.startsWith(`04_print/${size}/SAMPLE_`)), size).toBe(true);
    }
    expect(paths).toContain("07_labels/care_label_gb.pdf");
    expect(paths).toContain("07_labels/care_label_au.pdf");
  });

  it("gives byte-identical bytes when it is built twice from the same rows", async () => {
    const first = await buildPackage(buildKppInput(fixtureRows()), sources());
    const second = await buildPackage(buildKppInput(fixtureRows()), sources());

    if (!first.ok || !second.ok) throw new Error("The package did not build.");
    expect(sha256Hex(first.zip)).toBe(sha256Hex(second.zip));
  });

  it("builds well inside the 60 seconds docs/spec/04 allows", async () => {
    const started = Date.now();
    const built = await buildPackage(buildKppInput(fixtureRows()), sources());
    expect(built.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  it("refuses to build at all when a point of measure has no tolerance (owner decision 18)", async () => {
    const rows = fixtureRows();
    const poms = rows.article.poms.map((pom, index) => (index === 0 ? ({ ...pom, tolMinusMm: null, tolPlusMm: null } as unknown as typeof pom) : pom));

    const built = await buildPackage(buildKppInput({ ...rows, article: { ...rows.article, poms } }), sources());

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.message).join(" ")).toContain("no tolerance");
  });
});

describe("the values no table holds yet", () => {
  it("quotes the worked article's own consumption figures, so the fixture cannot drift from the evidence", () => {
    const bom = readArticleJson().bom as { consumption: string }[];
    const quoted = bom.map((line) => line.consumption).join(" | ");

    for (const row of FIXTURE_CONSUMPTION) expect(quoted, row.itemId).toContain(`${row.qtyPerPiece} ${row.unit}`);
    for (const row of FIXTURE_CONSUMPTION) expect(row.label).toContain("placeholder consumption");
  });

  it("quotes the worked article's own care-label wording for both markets", () => {
    const labels = readArticleJson().labels as Record<string, string[]>;

    expect(labels.uk?.[0]).toBe(FIXTURE_LABEL_WORDING.find((row) => row.country === "GB")?.fibre);
    expect(labels.au?.[0]).toBe(FIXTURE_LABEL_WORDING.find((row) => row.country === "AU")?.fibre);
    expect(labels.uk?.join(" ")).toContain("Made in Pakistan");
  });

  it("quotes the worked article's own AQL plan, which owner decision 19 uses for anyone else's sample", () => {
    expect(readArticleJson().qc).toMatchObject({ aql: expect.stringContaining(FIXTURE_UNSOURCED.quality.aqlPlan ?? "") });
  });
});
