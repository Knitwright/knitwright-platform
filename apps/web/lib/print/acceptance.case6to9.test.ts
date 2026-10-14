import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { BUILT_IN_GENERATORS, currentStack, type ArtworkStack } from "@/lib/artwork-stack";
import { BENCHMARK_DOTS, FILE_ID, LOGO_AND_TEXT, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import { printScale } from "@/lib/production/contract";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import { buildPrintSet } from "./build";
import { testCard, vectorLogo, type TestAsset } from "./fixtures/assets";
import { makeEnv } from "./fixtures/env";
import { TEST_GRADED_JERSEY } from "./fixtures/graded";
import { testCamo } from "./fixtures/generators";
import { readFromPicture } from "./fixtures/picture";
import { blendStack, camoStack, logoStack, panelStack, rosterStack } from "./fixtures/stacks";
import { shapeBounds } from "./geometry/boolean";
import { boundsOf, type Pt } from "./geometry/vec";
import { buildPieceScene } from "./layout/piece-scene";
import type { VectorLayer } from "./layout/scene";
import { planPlayers } from "./players";
import { textWidth } from "./text/font";

const generators = [...BUILT_IN_GENERATORS, testCamo];
const polka = currentStack(jersey({ kitPattern: BENCHMARK_DOTS, artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }));

/** The five designs of the acceptance list, each with the assets it needs. Cases 2 to 5 use stand-ins for the intake, generators and reader. */
async function fiveCases(): Promise<{ name: string; stack: ArtworkStack; assets: TestAsset[] }[]> {
  const card = await testCard(1200, 1600);
  return [
    { name: "polka-dot jersey", stack: polka, assets: [vectorLogo(FILE_ID)] },
    { name: "full-panel picture", stack: panelStack("card"), assets: [card] },
    { name: "vector logo", stack: logoStack("crest"), assets: [vectorLogo("crest")] },
    { name: "generated camo", stack: camoStack(7), assets: [] },
    { name: "read from a picture", stack: readFromPicture(camoStack(7)), assets: [] },
  ];
}

describe("case 6: shrink scale on all five designs", () => {
  it("scales art and cut line by 1.0204 x 1.0152 from a 2.0 / 1.5 % fabric test, and says so", async () => {
    const wanted = printScale({ shrinkLengthPct: { value: 2, source: "fabric-test", testId: "t" }, shrinkWidthPct: { value: 1.5, source: "fabric-test", testId: "t" } });
    expect(wanted.length).toBeCloseTo(1.0204, 4);
    expect(wanted.width).toBeCloseTo(1.0152, 4);
    for (const { name, stack, assets } of await fiveCases()) {
      const plain = await makeEnv(stack, { assets, generators });
      const shrunk = await makeEnv(stack, { assets, generators, shrinkLengthPct: 2, shrinkWidthPct: 1.5 });
      const [a, b] = [(await buildPieceScene(plain, { view: "back", size: "48" }))!, (await buildPieceScene(shrunk, { view: "back", size: "48" }))!];
      const [ba, bb] = [boundsOf(a.cutOutline), boundsOf(b.cutOutline)];
      // The pattern file's length runs along x and its width along y.
      expect((bb.maxX - bb.minX) / (ba.maxX - ba.minX), name).toBeCloseTo(wanted.length, 4);
      expect((bb.maxY - bb.minY) / (ba.maxY - ba.minY), name).toBeCloseTo(wanted.width, 4);
      expect(b.scale.length).toBeCloseTo(1.0204, 4);
      expect(b.notes.some((n) => n.includes("Scale applied: 1.0204 along the length and 1.0152 across")), name).toBe(true);
      expect(a.notes.some((n) => n.includes("Not scaled for shrink: this fabric has no shrink test.")), name).toBe(true);
    }
  }, 300_000);

  it("scales the art with the cut line: a 30 mm dot is 30 x 1.0204 mm along the length", async () => {
    const env = await makeEnv(polka, { assets: [vectorLogo(FILE_ID)], shrinkLengthPct: 2, shrinkWidthPct: 1.5 });
    const scene = (await buildPieceScene(env, { view: "back", size: "48" }))!;
    const dots = scene.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === "kit-pattern")!;
    const whole = dots.shapes.map((s) => shapeBounds(s.shape)).filter((b) => Math.abs(b.maxX - b.minX - 30 * 1.0204) < 0.1 && Math.abs(b.maxY - b.minY - 30 * 1.0152) < 0.1);
    expect(whole.length).toBeGreaterThan(10);
  }, 60_000);
});

describe("case 7: the 22-player sample roster", () => {
  it("makes a set per player with the right name and number, a manifest line per file, and reports the name that does not fit", async () => {
    const stack = rosterStack();
    const env = await makeEnv(stack);
    const plan = planPlayers({ order: ROSTER_22, stack, sizeMaps: DEFAULT_SIZE_LABEL_MAPS, patternSizes: TEST_GRADED_JERSEY.sizes });
    expect(plan.jobs).toHaveLength(22);
    const set = await buildPrintSet(env, { sizes: [], formats: ["pdf", "svg"], players: plan.jobs });
    const backs = set.files.filter((f) => f.view === "back" && f.format === "pdf");
    expect(backs).toHaveLength(22);
    expect(set.files).toHaveLength(22 * 2 * 2);
    expect(new Set(set.files.map((f) => f.path)).size).toBe(set.files.length);
    for (const job of plan.jobs) {
      const file = backs.find((f) => f.playerIndex === job.index)!;
      expect(file.player).toEqual(job.player);
      expect(file.size).toBe(job.size);
      expect(file.path).toContain(`players/${String(job.index).padStart(2, "0")}-${job.player.number}`);
      const scene = (await buildPieceScene(env, { view: "back", size: job.size, sizeLabel: job.label, player: job.player }))!;
      const mark = (id: string): VectorLayer => scene.layers.find((l): l is VectorLayer => l.kind === "vector" && l.layerId === id)!;
      expect(mark("mark-back-name").shapes).toHaveLength([...job.player.name].length);
      expect(mark("mark-back-number").shapes).toHaveLength([...job.player.number].length);
      // Not squeezed: the name is as wide as the font makes it at the stated height.
      const ink = boundsOf(mark("mark-back-name").shapes.flatMap((s) => s.shape.flat() as Pt[]));
      const nominal = textWidth(env.font, job.player.name, 30);
      expect(Math.abs(ink.maxY - ink.minY - nominal)).toBeLessThan(0.04 * nominal + 2);
      const fits = !scene.issues.some((i) => i.code === "name-does-not-fit");
      // A name wider than its place is reported, whatever it is called; the 14-letter one certainly is.
      if (job.player.name === "LOVEGROVE-HUNT") expect(fits).toBe(false);
      if (job.player.name.length <= 8) expect(fits, job.player.name).toBe(true);
    }
    const long = set.files.find((f) => f.player?.name === "LOVEGROVE-HUNT" && f.view === "back" && f.format === "pdf")!;
    expect(long.warnings.some((w) => /not squeezed/.test(w))).toBe(true);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(long.bytes) }).promise;
    expect(doc.numPages).toBe(2);
  }, 300_000);

  it("reports a label with no pattern size and a number that the league rules do not allow", async () => {
    const env = await makeEnv(rosterStack(), {
      overrides: { rules: { minTextHeightMm: 70, minLineMm: null, coloursToAvoid: [], numberRules: { minHeightMm: 100, maxHeightMm: 200, allowedDigits: "123", source: "Test league rules" } } },
    });
    const scene = (await buildPieceScene(env, { view: "back", size: "48", player: { name: "OKAFOR", number: "7" } }))!;
    const texts = scene.issues.map((i) => i.text).join("\n");
    expect(texts).toMatch(/must be 100 to 200 mm tall \(Test league rules\)/);
    expect(texts).toMatch(/digit 7 is not allowed/);
    expect(texts).toMatch(/asks for at least 70 mm/);
  }, 60_000);
});

describe("case 8: a blend that needs pixels", () => {
  it("makes the piece that uses multiply a raster, says so, and keeps the other pieces vector", async () => {
    const env = await makeEnv(blendStack());
    const [front, back] = [(await buildPieceScene(env, { view: "front", size: "48" }))!, (await buildPieceScene(env, { view: "back", size: "48" }))!];
    expect(back.flattened).toBe(true);
    expect(back.layers).toHaveLength(1);
    expect(back.layers[0].kind).toBe("raster");
    expect(back.notes.some((n) => /^Printed as pixels because dots-back mixes with the layers under it \(multiply\)/.test(n))).toBe(true);
    expect(front.flattened).toBe(false);
    expect(front.layers.every((l) => l.kind === "vector")).toBe(true);
    const set = await buildPrintSet(env, { sizes: ["48"], formats: ["pdf"], views: ["front", "back"] });
    const ops = async (view: string): Promise<Set<string>> => {
      const doc = await pdfjs.getDocument({ data: new Uint8Array(set.files.find((f) => f.view === view)!.bytes) }).promise;
      const names = Object.fromEntries(Object.entries(pdfjs.OPS).map(([k, v]) => [v, k]));
      return new Set((await (await doc.getPage(1)).getOperatorList()).fnArray.map((f) => names[f]));
    };
    expect([...(await ops("back"))].some((n) => /Image/.test(n))).toBe(true);
    expect([...(await ops("front"))].some((n) => /Image/.test(n))).toBe(false);
    expect(set.files.find((f) => f.view === "back")!.flattened).toBe(true);
  }, 180_000);
});

describe("case 9: the same inputs give the same files", () => {
  it("is byte-identical twice for all five designs in PDF and SVG", async () => {
    for (const { name, stack, assets } of await fiveCases()) {
      const hashes = async (): Promise<string[]> => {
        const env = await makeEnv(stack, { assets, generators });
        const set = await buildPrintSet(env, { sizes: ["48"], formats: ["pdf", "svg"], views: ["back", "collar"] });
        return set.files.map((f) => f.sha256);
      };
      expect(await hashes(), name).toEqual(await hashes());
    }
  }, 300_000);

  it("is byte-identical twice in TIFF", async () => {
    for (const { name, stack, assets } of await fiveCases()) {
      const hashes = async (): Promise<string[]> => {
        const env = await makeEnv(stack, { assets, generators });
        return (await buildPrintSet(env, { sizes: ["48"], formats: ["tiff"], views: ["collar"] })).files.map((f) => f.sha256);
      };
      expect(await hashes(), name).toEqual(await hashes());
    }
  }, 300_000);
});
