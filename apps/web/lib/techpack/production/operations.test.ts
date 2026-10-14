import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { buildConstruction } from "../construction";
import { PROPOSAL_WORDS } from "../text";
import { buildOperations } from "./operations";

const construction = buildConstruction(start("crew-tee"));
const stages = (technique: string | null, marks = false) => buildOperations(technique, construction, marks).steps.map((step) => step.stage);

describe("the order of work", () => {
  it("runs print, press, cut, sew, inspect for sublimation", () => {
    const order = stages("sublimation");
    expect(order.slice(0, 3)).toEqual(["print", "press", "cut"]);
    expect(order.at(-1)).toBe("inspect");
    expect(order.filter((stage) => stage === "sew")).toHaveLength(construction.seams.length);
  });

  it("applies another method to the cut pieces, before sewing", () => {
    expect(stages("embroidery").slice(0, 3)).toEqual(["cut", "decorate", "sew"]);
    expect(buildOperations("screen-print", construction, false).steps[1]?.label).toBe("Apply the screen print to the cut pieces.");
    expect(buildOperations("pad-print", construction, false).steps[1]?.label).toBe("Apply the pad-print to the cut pieces.");
  });

  it("leaves out print and press when the method is not set, and says so", () => {
    const section = buildOperations(null, construction, false);
    expect(stages(null)[0]).toBe("cut");
    expect(stages(null)).not.toContain("print");
    expect(section.note).toBe("The decoration method is not set, so the print and press steps are left out.");
    expect(section.technique).toEqual({ status: "to-be-confirmed" });
  });

  it("adds player names and numbers after sewing when the design has them", () => {
    const order = stages("sublimation", true);
    expect(order[order.length - 2]).toBe("decorate");
    expect(stages("sublimation", false)).not.toContain("decorate");
  });

  it("numbers the steps from 1, and says every one is only proposed", () => {
    const steps = buildOperations("sublimation", construction, false).steps;
    expect(steps.map((step) => step.order)).toEqual(steps.map((_, index) => index + 1));
    expect(steps.every((step) => step.detail.status === "set" && step.detail.value === PROPOSAL_WORDS)).toBe(true);
    expect(steps.find((step) => step.stage === "sew")?.label).toMatch(/^Sew the .+ The stitch is in Construction\.$/);
  });

  it("names the method as a derived value", () => {
    expect(buildOperations("sublimation", construction, false).technique).toMatchObject({ value: "sublimation", provenance: "derived" });
  });
});
