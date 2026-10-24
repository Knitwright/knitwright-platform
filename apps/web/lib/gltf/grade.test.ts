import { describe, expect, it } from "vitest";
import { TEE_GRADED } from "./fixtures/patterns";
import { gradeFactors, gradeModel } from "./grade";
import { buildPanelLayout } from "./layout";
import { generatePlaceholder } from "./placeholder";
import { validateModel } from "./validate";

const base = buildPanelLayout(TEE_GRADED, "48");
const model = generatePlaceholder(base);

describe("grading", () => {
  it("gives a factor of one for the base size", () => {
    for (const f of gradeFactors(base, base).factors) expect([f.sx, f.sy]).toEqual([1, 1]);
  });

  it("scales each panel by the ratio of its size in millimetres", () => {
    const xs = buildPanelLayout(TEE_GRADED, "XS");
    const { factors, issues } = gradeFactors(base, xs);
    expect(issues).toEqual([]);
    const front = factors.find((f) => f.panelId === "front");
    const b = base.panels.find((p) => p.id === "front");
    const t = xs.panels.find((p) => p.id === "front");
    expect(front?.sx).toBeCloseTo((t?.widthMm ?? 0) / (b?.widthMm ?? 1), 12);
    expect(front?.sy).toBeCloseTo((t?.heightMm ?? 0) / (b?.heightMm ?? 1), 12);
    expect(front?.sx).toBeLessThan(1);
  });

  it("makes XS smaller and 3XL larger", () => {
    const xs = gradeModel(model, base, buildPanelLayout(TEE_GRADED, "XS"));
    const xl = gradeModel(model, base, buildPanelLayout(TEE_GRADED, "3XL"));
    const scale = (m: typeof xs.model) => m.nodes.find((n) => n.name === "front")?.scale ?? [1, 1, 1];
    expect(scale(xs.model)[0]).toBeLessThan(1);
    expect(scale(xl.model)[0]).toBeGreaterThan(1);
    expect(scale(xl.model)[2]).toBe(1);
  });

  it("keeps the UV islands where they were: artwork is scaled by the geometry", () => {
    const graded = gradeModel(model, base, buildPanelLayout(TEE_GRADED, "3XL")).model;
    expect(validateModel(graded, base).ok).toBe(true);
  });

  it("shows the artwork at its true size: panel width times scale equals the target panel width", () => {
    const target = buildPanelLayout(TEE_GRADED, "3XL");
    const { model: graded } = gradeModel(model, base, target);
    for (const p of target.panels) {
      const node = graded.nodes.find((n) => n.name === p.id);
      const own = base.panels.find((b) => b.id === p.id);
      expect((own?.widthMm ?? 0) * (node?.scale?.[0] ?? 1)).toBeCloseTo(p.widthMm, 9);
    }
  });

  it("does not change the model it is given", () => {
    const before = JSON.stringify(model);
    gradeModel(model, base, buildPanelLayout(TEE_GRADED, "XS"));
    expect(JSON.stringify(model)).toBe(before);
  });

  it("reports a panel the target size does not have, and leaves it alone", () => {
    const target = { ...buildPanelLayout(TEE_GRADED, "XS"), panels: buildPanelLayout(TEE_GRADED, "XS").panels.filter((p) => p.id !== "collar") };
    const { factors, issues } = gradeFactors(base, target);
    expect(issues.join(" ")).toMatch(/collar/);
    expect(factors.find((f) => f.panelId === "collar")).toBeUndefined();
    expect(gradeModel(model, base, target).model.nodes.find((n) => n.name === "collar")?.scale).toBeUndefined();
  });
});
