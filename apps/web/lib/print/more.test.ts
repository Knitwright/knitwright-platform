import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import { buildPrintSet } from "./build";
import { testCard } from "./fixtures/assets";
import { makeEnv, testFont } from "./fixtures/env";
import { TEST_GRADED_JERSEY } from "./fixtures/graded";
import { panelStack, rosterStack } from "./fixtures/stacks";
import { DEFAULT_SETTINGS } from "./layout/context";
import { marginNotes } from "./layout/notes";
import { buildPieceScene } from "./layout/piece-scene";
import { planPlayers } from "./players";
import { renderFile } from "./render/files";
import { fakeDeps } from "./server/test-deps";
import { printSummary } from "./server/summary";
import { iccName } from "./server/settings";

const stack = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: MARKS }));

describe("players on a pattern short of pieces", () => {
  it("names the player whose piece the pattern lacks, and keeps to the pieces asked for", async () => {
    const pattern = { ...TEST_GRADED_JERSEY, piecesBySize: Object.fromEntries(Object.entries(TEST_GRADED_JERSEY.piecesBySize).map(([k, v]) => [k, v.filter((p) => p.id !== "front")])) };
    const env = await makeEnv(stack, { pattern });
    const plan = planPlayers({ order: { ...ROSTER_22, rows: ROSTER_22.rows.slice(0, 1) }, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: pattern.sizes });
    const set = await buildPrintSet(env, { sizes: [], formats: ["pdf"], players: plan.jobs });
    expect(set.files.map((f) => f.view)).toEqual(["back"]);
    expect(set.problems[0]).toMatch(/OKAFOR: this pattern has no front piece in size 48/);
    const only = await buildPrintSet(await makeEnv(stack), { sizes: [], formats: ["pdf"], players: plan.jobs, views: ["back"] });
    expect(only.files.map((f) => f.view)).toEqual(["back"]);
    const nameless = planPlayers({ order: { ...ROSTER_22, rows: [{ ...ROSTER_22.rows[0], name: "" }] }, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: pattern.sizes });
    const set2 = await buildPrintSet(env, { sizes: [], formats: ["pdf"], players: nameless.jobs });
    expect(set2.problems[0]).toMatch(/^A player: this pattern has no front piece/);
  }, 120_000);
});

describe("a very large page", () => {
  it("lowers the resolution under the pixel cap, says so, and prints without a bleed when the profile has none", async () => {
    const env = await makeEnv(rosterStack(), { overrides: { settings: { ...DEFAULT_SETTINGS, dpi: 1200, minDpi: 72 } } });
    const scene = (await buildPieceScene(env, { view: "back", size: "48" }))!;
    expect(scene.dpi).toBeLessThan(1200);
    expect(scene.issues.some((i) => i.code === "dpi-lowered")).toBe(true);
    expect(scene.notes.some((n) => /Lowered from 1200 dpi/.test(n))).toBe(true);
    const none = await makeEnv(rosterStack(), { overrides: { settings: { ...DEFAULT_SETTINGS, bleedMm: 0 } } });
    const flush = (await buildPieceScene(none, { view: "collar", size: "48" }))!;
    expect(flush.bleedOutline).toBe(flush.cutOutline);
    expect(flush.box.minX).toBeCloseTo(Math.min(...flush.cutOutline.map((p) => p[0])), 6);
  }, 60_000);
});

describe("the margin notes", () => {
  it("say where the settings came from and what the profile is called", async () => {
    const env = await makeEnv(rosterStack(), { overrides: { patternReviewed: true, settings: { ...DEFAULT_SETTINGS, source: "print-house", iccBytes: new Uint8Array(1), iccName: null } } });
    const notes = marginNotes({ env, req: { view: "back", size: "48", sizeLabel: "M", player: { name: "", number: "7" } }, pieceName: "back", lowestDpi: 99.4, dpi: 150, dpiLowered: false, flattenedBy: "x mixes", fromPicture: true, agreement: [], extra: [], issues: [] });
    expect(notes[0]).toBe("back | size 48 (M) | (no name) #7");
    expect(notes).toContain("Lowest picture resolution on this piece: about 99 dpi.");
    expect(notes).toContain("Bleed 15 mm and 150 dpi (from your print house).");
    expect(notes).toContain("Colour profile embedded: from your print house.");
    expect(notes.some((n) => /Draft pattern/.test(n))).toBe(false);
    expect(notes).toContain("Printed as pixels because x mixes.");
  });
});

describe("the summary with a print house profile", () => {
  it("says the settings are the print house's and names the colour profile", async () => {
    const deps = fakeDeps({ settings: async () => ({ ...DEFAULT_SETTINGS, source: "print-house", iccBytes: new Uint8Array(1), iccName: "FOGRA39" }), rules: async () => ({ minTextHeightMm: 20, minLineMm: null, coloursToAvoid: [], numberRules: null }) });
    const s = await printSummary(deps, { query: {} });
    expect(s.settings.label).toBe("From your print house");
    expect(s.settings.colourProfile).toBe("Colour profile: FOGRA39.");
    expect(s.rules).toBe("League rules are set for this download.");
  });
});

describe("a colour profile used twice", () => {
  it("writes the profile file once and attaches it to each TIFF", async () => {
    const icc = (await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).withIccProfile("p3").png().toBuffer().then((b) => sharp(b).metadata())).icc!;
    const env = await makeEnv(panelStack("card"), { assets: [await testCard(600, 800)], overrides: { settings: { ...DEFAULT_SETTINGS, iccBytes: new Uint8Array(icc) } } });
    const scene = (await buildPieceScene(env, { view: "back", size: "50" }))!;
    const [a, b] = [await renderFile(scene, "tiff", { font: await testFont(), settings: env.settings }), await renderFile(scene, "tiff", { font: await testFont(), settings: env.settings })];
    expect(a.sha256).toBe(b.sha256);
    expect(iccName(new Uint8Array(icc))).toBeTypeOf("string");
  }, 120_000);
});
