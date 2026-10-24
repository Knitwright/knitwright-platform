import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductionPanel } from "./ProductionPanel";

const html = renderToStaticMarkup(createElement(ProductionPanel));

describe("the production panel", () => {
  it("shows the readiness list and then the four parts in the order a design is made", () => {
    const order = ["validation-heading", "patterns-heading", "fabrics-heading", "print-files-heading", "team-orders-heading"].map((id) => html.indexOf(id));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("says nothing is built yet, in plain words, without claiming anything is settled", () => {
    expect(html).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready)\b/i);
  });
});
