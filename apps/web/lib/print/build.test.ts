import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import { buildPrintSet, MAX_FILES, TooManyFiles, zipPrintSet } from "./build";
import { makeEnv } from "./fixtures/env";
import { TEST_GRADED_JERSEY } from "./fixtures/graded";
import { camoStack, rosterStack } from "./fixtures/stacks";
import { manifestCsv, manifestJson, manifestLines, readmeText } from "./manifest";
import { planPlayers } from "./players";
import { DEFAULT_SETTINGS } from "./layout/context";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: MARKS }));

describe("a print set", () => {
  it("keeps sizes, pieces and formats in the order asked for", async () => {
    const env = await makeEnv(stack);
    const set = await buildPrintSet(env, { sizes: ["50", "46"], formats: ["svg", "pdf"], views: ["collar", "back"] });
    expect(set.files.map((f) => f.path)).toEqual([
      "pieces/collar_50.svg",
      "pieces/collar_50.pdf",
      "pieces/back_50.svg",
      "pieces/back_50.pdf",
      "pieces/collar_46.svg",
      "pieces/collar_46.pdf",
      "pieces/back_46.svg",
      "pieces/back_46.pdf",
    ]);
  }, 60_000);

  it("refuses a request for more files than one download may make, naming the count", async () => {
    const env = await makeEnv(camoStack(1), { generators: undefined });
    await expect(buildPrintSet(env, { sizes: ["44", "46"], formats: ["pdf", "svg"], views: ["collar"], maxFiles: 3 })).rejects.toThrow(/would make 4 files, and one request can make 3/);
    expect(new TooManyFiles(401, MAX_FILES).message).toContain("401");
  }, 60_000);

  it("names a piece the pattern lacks instead of failing", async () => {
    const env = await makeEnv(stack, { pattern: { ...TEST_GRADED_JERSEY, piecesBySize: Object.fromEntries(Object.entries(TEST_GRADED_JERSEY.piecesBySize).map(([k, v]) => [k, v.filter((p) => p.id !== "collar")])) } });
    const set = await buildPrintSet(env, { sizes: ["48"], formats: ["pdf"], views: ["collar", "back"] });
    expect(set.files.map((f) => f.view)).toEqual(["back"]);
    expect(set.problems[0]).toMatch(/no collar piece in size 48/);
  }, 60_000);

  it("makes a set per player, leaves their pieces out of the general set, and a transfer set when the marks are transfers", async () => {
    const transfer = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: { ...MARKS, technique: "transfer" } }));
    const env = await makeEnv(transfer);
    const plan = planPlayers({ order: { ...ROSTER_22, rows: ROSTER_22.rows.slice(0, 2) }, stack: transfer, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: TEST_GRADED_JERSEY.sizes });
    const request = { sizes: ["48"], formats: ["pdf" as const], players: plan.jobs, views: ["back" as const, "front" as const, "collar" as const] };
    const set = await buildPrintSet(env, request);
    const paths = set.files.map((f) => f.path);
    expect(paths).toContain("pieces/collar_48.pdf");
    expect(paths).not.toContain("pieces/back_48.pdf");
    expect(paths).toContain("players/01-7-OKAFOR/back_48.pdf");
    expect(paths).toContain("players/01-7-OKAFOR/transfer/back_48.pdf");
    expect(set.files.find((f) => f.path.includes("transfer"))!.kind).toBe("transfer");
  }, 120_000);

  it("zips the files with a manifest and a note, the same bytes twice", async () => {
    const env = await makeEnv(rosterStack());
    const request = { sizes: ["48"], formats: ["pdf" as const], views: ["collar" as const] };
    const set = await buildPrintSet(env, request);
    const zip = zipPrintSet(env, set, request, { designName: "Test", folderName: "t-v1" });
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(["t-v1/README.txt", "t-v1/manifest.csv", "t-v1/manifest.json", "t-v1/pieces/collar_48.pdf"]);
    expect(Buffer.from(zipPrintSet(env, set, request, { designName: "Test", folderName: "t-v1" })).equals(Buffer.from(zip))).toBe(true);
  }, 60_000);
});

describe("the manifest and the note", () => {
  it("quotes what a spreadsheet would split, and writes the player and the picture's resolution", async () => {
    const env = await makeEnv(rosterStack());
    const set = await buildPrintSet(env, { sizes: ["48"], formats: ["svg"], views: ["collar"] });
    const lines = manifestLines([{ ...set.files[0], player: { name: 'O"Neil, Jr', number: "7" }, lowestDpi: 142.6, flattened: true, warnings: ["a, b", "c"] }]);
    const csv = manifestCsv(lines);
    expect(csv.split("\r\n")[0]).toContain("sha256");
    expect(csv).toContain('"O""Neil, Jr"');
    expect(csv).toContain(",143,pixels,");
    expect(csv).toContain('"a, b | c"');
    expect(JSON.parse(manifestJson(lines, { design: "x" })).files).toHaveLength(1);
  }, 60_000);
  it("states the settings and what is a draft, and lists what was not made", async () => {
    const env = await makeEnv(rosterStack());
    const base = { env, designName: "Test", fileCount: 3, playerCount: 0, problems: [] as string[], formats: ["pdf", "tiff"] as const };
    const plain = readmeText({ ...base, formats: ["pdf", "tiff"] });
    expect(plain).toContain("Bleed: 15 mm (Knitwright default, not from your print house).");
    expect(plain).toContain("Draft pattern, not reviewed.");
    expect(plain).toContain("3 files in PDF, TIFF.");
    const full = readmeText({
      ...base,
      formats: ["pdf"],
      playerCount: 5,
      problems: ["Row 3 has no size."],
      env: { ...env, patternReviewed: true, settings: { ...DEFAULT_SETTINGS, source: "print-house", iccBytes: new Uint8Array(1), iccName: "FOGRA39" } },
    });
    expect(full).toContain("with a set for each of 5 players");
    expect(full).toContain("from your print house");
    expect(full).toContain("Colour profile: FOGRA39.");
    expect(full).not.toContain("Draft pattern");
    expect(full).toContain("- Row 3 has no size.");
  }, 60_000);
});
