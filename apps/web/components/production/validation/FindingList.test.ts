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

  it("never uses the words the wording rules forbid", () => {
    const html = render([finding({ code: "a-a", severity: "warning", message: "Open.", action: "Ask.", whoActs: "factory" })]);
    expect(html).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i);
  });
});
