import { describe, expect, it } from "vitest";
import type { EditorDesign } from "@/lib/editor/slots";
import { jersey } from "@/lib/editor/fixtures/article";
import { RULE_ID_PATTERN } from "@/lib/validation/rules";
import { fullDesign } from "../fixtures/designs";
import {
  CHARGE_WORDS,
  EXPORT_PANEL_TABS,
  IMAGE_SIZES,
  IMAGE_TYPES,
  IMAGE_VIEWS,
  PANEL_TABS,
  PATTERN_FORMATS,
  RECOMMENDED_IMAGE_SIZE,
  TECH_PACK_SECTIONS,
  type ExportOutput,
  type PanelInput,
} from "./panel";
import { imageOutputs, mockupsAddress, outputsFor, patternOutputs, printOutputs, techPackOutputs, type PanelOptions } from "./panel-outputs";
import { exportGate, reviewFromDesign } from "./review-gate";

/** The Export panel's own choices and what each one would produce (spec F-S6, decision 0078). */

const PROJECT = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const input: PanelInput = { projectId: PROJECT, version: 3, colourwayId: "home", size: "M", views: ["front", "back"] };

const options: PanelOptions = {
  images: { view: "front", type: "svg", size: RECOMMENDED_IMAGE_SIZE, withMannequin: false, withBackground: false },
  pattern: { format: "pdf-1-1", withArtwork: true, withMeasurements: false },
  everySize: false,
};

const addresses = (outputs: readonly ExportOutput[]): readonly string[] => outputs.flatMap((output) => (output.address === null ? [] : [output.address]));
const notYet = (outputs: readonly ExportOutput[]): readonly string[] => outputs.flatMap((output) => output.notYet ?? []);

describe("the six tabs of the Export panel", () => {
  it("is the specification's six tabs, in its order", () => {
    expect(PANEL_TABS.map((tab) => tab.id)).toEqual([...EXPORT_PANEL_TABS]);
    expect(PANEL_TABS.map((tab) => tab.label)).toEqual(["Tech pack", "Images", "Pattern", "Print files", "Production package", "Mockups & media"]);
  });

  it("says what each tab costs, and names a credit kind only for a tab that is charged", () => {
    for (const tab of PANEL_TABS) {
      expect(CHARGE_WORDS[tab.charge], tab.id).toMatch(/\.$/);
      if (tab.charge === "free") expect(tab.kind, tab.id).toBeNull();
    }
    expect(PANEL_TABS.filter((tab) => tab.charge === "free").map((tab) => tab.id)).toEqual(["tech-pack", "images"]);
  });

  it("offers the tech pack sections the specification lists, and never the Review tab", () => {
    expect(TECH_PACK_SECTIONS.map((section) => section.label)).toEqual([
      "Overview",
      "Body size chart",
      "Measurements",
      "Materials",
      "Callouts",
      "Artworks",
      "Colourways",
      "Personalisation",
      "Labels and packaging",
      "QC",
    ]);
  });

  it("offers the views, types and sizes the specification lists", () => {
    expect(IMAGE_VIEWS).toEqual(["front", "back", "left", "right", "all"]);
    expect(IMAGE_TYPES).toContain("png");
    expect(IMAGE_TYPES).toContain("jpg");
    expect(IMAGE_SIZES).toContain(RECOMMENDED_IMAGE_SIZE);
    expect(PATTERN_FORMATS).toEqual(["dxf-aama", "pdf-1-1", "svg", "png"]);
  });
});

describe("what each tab would produce", () => {
  it("builds the tech pack from the export route, at the version and colourway the editor shows", () => {
    expect(addresses(techPackOutputs(input))).toEqual([
      `/api/projects/${PROJECT}/exports/pdf?version=3&colourway=home`,
      `/api/projects/${PROJECT}/exports/xlsx?version=3&colourway=home`,
    ]);
    expect(notYet(techPackOutputs(input))).toEqual([]);
  });

  it("names the sixteen pages and the eleven sheets in the labels, so nobody has to guess", () => {
    expect(techPackOutputs(input).map((output) => output.label)).toEqual(["PDF, 16 pages", "Excel, 11 sheets"]);
  });

  it("sends the front and the back as drawings, which the same design always draws the same way", () => {
    expect(addresses(imageOutputs(input, options.images))).toEqual([`/api/projects/${PROJECT}/exports/svg?version=3&colourway=home&view=front`]);
    const all = imageOutputs(input, { ...options.images, view: "all" });
    expect(all.map((output) => output.label)).toEqual(["Front drawing (SVG)", "Back drawing (SVG)"]);
  });

  it("says plainly that there is no side view, rather than offering one", () => {
    for (const view of ["left", "right"] as const) {
      const outputs = imageOutputs(input, { ...options.images, view });
      expect(addresses(outputs), view).toEqual([]);
      expect(notYet(outputs).join(" "), view).toContain("front and the back only");
    }
  });

  it("says plainly that PNG and JPG at a size are not made yet", () => {
    for (const type of ["png", "jpg"] as const) {
      const outputs = imageOutputs(input, { ...options.images, type });
      expect(addresses(outputs), type).toEqual([]);
      expect(notYet(outputs).join(" "), type).toContain("not made yet");
    }
  });

  it("says what a mannequin and a background would mean for a drawing, so neither switch changes nothing", () => {
    const plain = imageOutputs(input, options.images);
    const dressed = imageOutputs(input, { ...options.images, withMannequin: true });
    expect(dressed).not.toEqual(plain);
    expect(notYet(dressed).join(" ")).toContain("no mannequin");
    expect(notYet(imageOutputs(input, { ...options.images, withBackground: true })).join(" ")).toContain("no background");
  });

  it("makes the pattern at full size and as an SVG from the print files route, for the size on the canvas", () => {
    expect(addresses(patternOutputs(input, options.pattern))).toEqual([`/api/projects/${PROJECT}/print-files?formats=pdf&colourway=home&size=M`]);
    expect(addresses(patternOutputs(input, { ...options.pattern, format: "svg" }))).toEqual([
      `/api/projects/${PROJECT}/print-files?formats=svg&colourway=home&size=M`,
    ]);
  });

  it("points at the pattern page for the DXF, and offers no picture of a pattern", () => {
    expect(notYet(patternOutputs(input, { ...options.pattern, format: "dxf-aama" })).join(" ")).toContain("Pattern page");
    expect(addresses(patternOutputs(input, { ...options.pattern, format: "png" }))).toEqual([]);
  });

  it("answers differently when measurements on the pieces are asked for", () => {
    const with_ = patternOutputs(input, { ...options.pattern, withMeasurements: true });
    expect(with_).not.toEqual(patternOutputs(input, options.pattern));
    expect(notYet(with_).join(" ")).toContain("not made yet");
  });

  it("makes the print files for one size, or for every size when that is asked for", () => {
    expect(addresses(printOutputs(input, false))).toEqual([`/api/projects/${PROJECT}/print-files?formats=pdf,svg&colourway=home&size=M`]);
    expect(addresses(printOutputs(input, true))).toEqual([`/api/projects/${PROJECT}/print-files?formats=pdf,svg&colourway=home`]);
    expect(printOutputs(input, false)[0]?.label).toContain("size M");
  });

  it("offers no download for the production package, and says where it goes instead", () => {
    const outputs = outputsFor("production-package", input, options);
    expect(addresses(outputs)).toEqual([]);
    expect(notYet(outputs).join(" ")).toContain("when the order is placed");
  });

  it("opens the marketing media screen for mockups until the launch studio lands", () => {
    expect(addresses(outputsFor("mockups", input, options))).toEqual([`/studio/${PROJECT}?tool=media`]);
    expect(mockupsAddress(input)).toBe(`/studio/${PROJECT}?tool=media`);
  });

  it("gives every tab something to show, and every address a route of this platform", () => {
    for (const tab of EXPORT_PANEL_TABS) {
      const outputs = outputsFor(tab, input, options);
      expect(outputs.length, tab).toBeGreaterThan(0);
      for (const output of outputs) {
        expect(output.label.length, tab).toBeGreaterThan(2);
        if (output.address === null) expect(output.notYet, tab).not.toBeNull();
        else expect(output.address, tab).toMatch(/^\/(api\/projects|studio)\//);
      }
    }
  });

  it("escapes what goes into an address, so a strange id cannot change the request", () => {
    const odd = { ...input, colourwayId: "home & away?x=1" };
    expect(addresses(techPackOutputs(odd))[0]).toContain("colourway=home%20%26%20away%3Fx%3D1");
  });
});

describe("the gate on export", () => {
  const design = (patch: Partial<Pick<EditorDesign, "draft" | "article" | "form">> = {}) => ({
    draft: null,
    article: null,
    form: { options: {}, parameters: {} },
    ...patch,
  });

  it("is open when the editor knows of nothing wrong, and still says the Review tab has not checked it", () => {
    const gate = exportGate(reviewFromDesign(design()));
    expect(gate.open).toBe(true);
    expect(gate.items).toEqual([]);
    expect(gate.caution).toContain("Review tab has not checked this version");
  });

  it("is shut while the drafter refuses the form, and names what to fix with its rule", () => {
    const findings = [{ field: "body_length_delta", message: "Body length is outside the approved range.", ruleId: "R-PAT-005" }];
    const gate = exportGate(reviewFromDesign(design({ draft: { kind: "invalid", findings }, article: jersey() })));
    expect(gate.open).toBe(false);
    expect(gate.reason).toContain("before you export");
    expect(gate.items.map((item) => item.ruleId)).toEqual(["R-PAT-005"]);
    for (const item of gate.items) expect(item.ruleId).toMatch(RULE_ID_PATTERN);
  });

  it("is shut while the Review tab asks for anything, whoever reported it", () => {
    const item = { key: "measurements:chest", label: "Chest width needs your input.", tab: "Measurements", ruleId: "R-GAP-000" };
    const gate = exportGate({ reviewed: true, needsInput: [item], blockers: [] });
    expect(gate.open).toBe(false);
    expect(gate.reason).toContain("Review tab");
    expect(gate.items).toEqual([item]);
    expect(gate.caution).toBeNull();
  });

  it("is open only once the Review tab reports nothing at all", () => {
    expect(exportGate({ reviewed: true, needsInput: [], blockers: [] })).toEqual({ open: true, reason: null, items: [], caution: null });
  });

  it("reports no Needs your input of its own, because a slot is handed the design and not the tech pack", () => {
    const review = reviewFromDesign(design({ article: jersey(), form: { options: {}, parameters: {} } }));
    expect(review.reviewed).toBe(false);
    expect(review.needsInput).toEqual([]);
  });

  it("reads a real design without throwing", () => {
    expect(() => exportGate(reviewFromDesign({ draft: null, article: jersey(), form: { options: { collar: "C01" }, parameters: {} } }))).not.toThrow();
    expect(fullDesign("crew-tee").typeId).toBe("crew-tee");
  });
});
