import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { finding } from "@/lib/validation/finding";
import { FindingList } from "./FindingList";

const render = (findings: Parameters<typeof FindingList>[0]["findings"]) => renderToStaticMarkup(createElement(FindingList, { findings }));

describe("the finding list", () => {
  it("says plainly when nothing is open", () => {
    expect(render([])).toContain("Nothing is open");
  });

  it("names the blocker, what to do and who", () => {
    const html = render([finding({ code: "readiness-fabric-test", severity: "blocker", message: "Fabric: needs a test.", action: "Get a fabric test.", whoActs: "print-house" })]);
    expect(html).toContain('data-testid="finding-readiness-fabric-test"');
    expect(html).toContain("Blocks ordering.");
    expect(html).toContain("Your print house: Get a fabric test.");
  });

  // Plan v6 D1 (decision 0132; spec F-0): "each failing check with 'Why?' and 'Fix' links".
  it("gives each finding a Why? for its rule and a Fix link to the screen that fixes it", () => {
    const why = (ruleId: string, context: string) => createElement("span", { "data-why": ruleId, "data-context": context }, "Why?");
    const listed = [
      { ...finding({ code: "seam-cross", severity: "blocker", message: "Crosses a seam.", action: "Move the logo.", whoActs: "owner" }), ruleId: "R-SUB-004" },
      finding({ code: "readiness-fabric-test", severity: "blocker", message: "Fabric: needs a test.", action: "Get a fabric test.", whoActs: "print-house" }),
    ];
    const html = renderToStaticMarkup(createElement(FindingList, { findings: listed, projectId: "p1", why }));
    expect(html).toContain('data-why="R-SUB-004"');
    expect(html).toContain('data-context="validation seam-cross"');
    expect(html).toContain('href="/project/p1?focus=garment&amp;tool=logos"');
    expect(html).toContain('href="/studio/p1/tech-pack"');
    expect(html).toContain("Fix<span class=\"sr-only\">: Move the logo.</span>");
  });

  it("shows the action without a link where no screen of the brand's can fix it", () => {
    const html = renderToStaticMarkup(
      createElement(FindingList, { findings: [finding({ code: "moq-not-set", severity: "warning", message: "No minimum.", action: "Ask the factory.", whoActs: "factory" })], projectId: "p1" }),
    );
    expect(html).toContain("Your factory: Ask the factory.");
    expect(html).not.toContain("finding-fix");
  });

  it("never uses the words the wording rules forbid", () => {
    const html = render([finding({ code: "a-a", severity: "warning", message: "Open.", action: "Ask.", whoActs: "factory" })]);
    expect(html).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i);
  });
});
