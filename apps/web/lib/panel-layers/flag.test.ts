import { describe, expect, it } from "vitest";
import { panelLayersOn } from "./flag";

describe("the panel layers flag", () => {
  it("is off unless it is exactly on", () => {
    expect(panelLayersOn({})).toBe(false);
    expect(panelLayersOn({ NEXT_PUBLIC_PANEL_LAYERS: "" })).toBe(false);
    expect(panelLayersOn({ NEXT_PUBLIC_PANEL_LAYERS: "off" })).toBe(false);
    expect(panelLayersOn({ NEXT_PUBLIC_PANEL_LAYERS: "true" })).toBe(false);
    expect(panelLayersOn({ NEXT_PUBLIC_PANEL_LAYERS: "on" })).toBe(true);
  });
});
