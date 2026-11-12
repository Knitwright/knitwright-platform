import { describe, expect, it } from "vitest";
import { renderOf } from "./render";

describe("renderOf", () => {
  it("draws the front of a garment type as an SVG data address, once per type", () => {
    const render = renderOf("football-shirt");
    expect(render?.src).toMatch(/^data:image\/svg\+xml/);
    expect(render?.alt.length).toBeGreaterThan(0);
    expect(renderOf("football-shirt")).toBe(render);
  });

  it("has no render for an article with no garment type, or an unknown one", () => {
    expect(renderOf(null)).toBeNull();
    expect(renderOf("no-such-type")).toBeNull();
  });
});
