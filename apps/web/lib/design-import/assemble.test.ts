import { describe, expect, it } from "vitest";
import { AS_READ, buildReport, buildStack } from "./assemble";
import { toStackColours } from "./colours";
import { analysisView } from "./view-model";
import type { PatternProposal } from "./pattern";
import { FORBIDDEN_WORDS, reportSentences } from "./report";
import type { StoredImport } from "./service";
import type { PictureKind } from "./types";

const colours = toStackColours([{ lab: [40, 60, 30], rgb: [200, 16, 46], hex: "#c8102e", share: 1 }]);
const proposal = (kind: PatternProposal["kind"], dpi: number | null, repeat = true): PatternProposal => ({
  layer: { id: `p-${kind}`, kind: "pattern", views: ["front"], opacity: 1, blend: "normal", provenance: "read-from-image", generatorId: "dots", params: {}, datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } }, colourIds: ["colour-1"] },
  kind,
  confidence: 0.5,
  note: "n",
  repeat: repeat ? { widthMm: 70, heightMm: 35, label: "estimated, check it" } : null,
  alternative: null,
  effectiveDpi: dpi,
});
const parts = (kind: PictureKind, proposals: PatternProposal[] = []) => ({
  kind,
  readingConfidence: 0.8,
  fits: [],
  fitItems: [],
  groundItem: { id: "ground", layerId: "ground", label: "Ground", confidence: 0.9, note: "" },
  markItems: [],
  proposals,
  patternReads: true,
  absent: [],
  failed: [],
  notes: [],
  guessed: [],
  fittedTo: "x",
  generatedPixels: false,
  spend: { visionCalls: 1, imageEdits: 0 },
  layerCount: 1,
});

describe("buildStack", () => {
  it("builds a valid stack with an as-read colourway, and refuses a layer that breaks the rules", () => {
    const built = buildStack(["front"], colours, []);
    expect(built.ok && built.stack.colourways[0].id).toBe(AS_READ);
    const bad = buildStack(["front"], colours, [{ ...proposal("generator", null).layer, views: ["back"] }]);
    expect(bad.ok).toBe(false);
  });
});

describe("buildReport", () => {
  it("has a plain note for each kind of picture and never the forbidden words", () => {
    const kinds: PictureKind[] = ["flat", "mockup", "worn-photo", "sketch", "sheet"];
    const notes = kinds.map((k) => buildReport(parts(k)).pictureNote);
    expect(new Set(notes).size).toBe(5);
    for (const k of kinds) for (const s of reportSentences(buildReport(parts(k, [proposal("generator", 300), proposal("tile", 60), proposal("panel", null, false)])))) expect(s).not.toMatch(FORBIDDEN_WORDS);
  });

  it("labels each kind of pattern proposal, warns about low dpi only, and notes an estimated repeat once", () => {
    const report = buildReport(parts("flat", [proposal("generator", 300), proposal("tile", 60), proposal("panel", null, false)]));
    expect(report.items.map((i) => i.label)).toEqual(["Ground", "All-over pattern, as a pattern from our list", "All-over pattern, as a repeating picture", "Full-panel picture"]);
    expect(report.dpiWarnings).toHaveLength(1);
    expect(report.notes.filter((n) => /estimated/.test(n))).toHaveLength(1);
    expect(buildReport({ ...parts("flat"), patternReads: false, layerCount: 2 }).notes.join(" ")).toMatch(/not read yet/);
    expect(buildReport({ ...parts("flat"), layerCount: 2 }).summary).toContain("2 layers");
  });
});

describe("analysisView", () => {
  it("gives a layer with no report item zero confidence and its own name", () => {
    const stack = buildStack(["front"], colours, []);
    if (!stack.ok) throw new Error("stack");
    const stored = { id: "i", sourceFileId: "f", status: "accepted", report: { ...buildReport(parts("flat")), items: [] }, overlay: { views: [], marks: [] }, stack: stack.stack, acceptedStack: stack.stack } as unknown as StoredImport;
    const view = analysisView(stored);
    expect(view.rows[0]).toMatchObject({ id: "ground", label: "Ground", confidence: 0, level: "low", needsOwnFile: false });
    expect(view.savedAsDesign).toBe(true);
  });
});
