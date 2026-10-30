import { describe, expect, it } from "vitest";
import { PLACEHOLDER_LABEL } from "@/lib/gltf";
import { draftChecks, draftForEditor, modelForDraft, opensIn3d } from "./draft";
import { defaultForm } from "./form";
import { jersey } from "./fixtures/article";

/** The Form toolbar through the drafter (X3) and on into the 3D view (lib/gltf). */

const form = () => defaultForm(jersey());

describe("draftForEditor", () => {
  it("drafts the shown size of the worked article into the production contract's pieces", () => {
    const draft = draftForEditor("JSY-SS-01", "M", form());

    expect(draft?.kind).toBe("drafted");
    if (draft?.kind !== "drafted") return;
    expect(draft.pieces.map((piece) => piece.id)).toEqual(["front", "back", "sleeve", "neck-rib"]);
    expect(draft.pieces.every((piece) => piece.sizeLabel === "M")).toBe(true);
    expect(draft.draft.checks.length).toBeGreaterThan(0);
  });

  it("re-drafts when a length changes, and the pieces change with it", () => {
    const short = draftForEditor("JSY-SS-01", "M", { ...form(), parameters: { ...form().parameters, body_length_offset: -30 } });
    const long = draftForEditor("JSY-SS-01", "M", { ...form(), parameters: { ...form().parameters, body_length_offset: 40 } });

    expect(short?.kind).toBe("drafted");
    expect(long?.kind).toBe("drafted");
    if (short?.kind !== "drafted" || long?.kind !== "drafted") return;
    const body = (draft: typeof short) => draft.draft.checks.find((check) => check.label.includes("B"))?.target;
    expect(body(long)).toBeGreaterThan(body(short) as number);
  });

  it("says plainly that an article with no script is not drafted yet, and names no shape for it", () => {
    const draft = draftForEditor("TEE-TR-01", "M", { options: {}, parameters: {} });

    expect(draft).toEqual({ kind: "not-drafted-yet", reason: "Not drafted yet: there is no drafting script for TEE-TR-01.", ruleId: null });
    expect(modelForDraft(draft)).toBeNull();
    expect(opensIn3d(draft)).toBe(false);
  });

  it("reports a value the article does not offer rather than clamping it", () => {
    const draft = draftForEditor("JSY-SS-01", "M", { options: {}, parameters: { body_length_offset: 500 } });

    expect(draft?.kind).toBe("invalid");
    if (draft?.kind !== "invalid") return;
    expect(draft.findings[0]?.field).toBe("parameters.body_length_offset");
    expect(draft.findings[0]?.ruleId).toMatch(/^R-/);
  });

  it("is nothing for a design with no base article", () => {
    expect(draftForEditor(null, "M", { options: {}, parameters: {} })).toBeNull();
    expect(draftChecks(null)).toEqual([]);
  });
});

describe("modelForDraft", () => {
  it("builds the placeholder model from the drafted panels, labelled as a placeholder", () => {
    const model = modelForDraft(draftForEditor("JSY-SS-01", "M", form()));

    expect(model?.label).toBe(PLACEHOLDER_LABEL);
    expect(model?.layout.panels.map((panel) => panel.id)).toEqual(["front", "back", "sleeve-left", "sleeve-right"]);
    expect(model?.model.asset.extras?.knitwright.placeholder).toBe(true);
  });

  it("opens the shell on 3D for an article the drafter can draw", () => {
    expect(opensIn3d(draftForEditor("JSY-SS-01", "M", form()))).toBe(true);
  });

  it("gives the canvas the points of measure the draft was built to", () => {
    const checks = draftChecks(draftForEditor("JSY-SS-01", "M", form()));

    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) expect(Math.abs(check.actual - check.target)).toBeLessThan(5);
  });
});
