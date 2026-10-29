import { describe, expect, it } from "vitest";
import { CANVAS_VIEWS, DEFAULT_VIEW, parseBeside, parseView, showing, toggled, VIEWS, viewsShown } from "./index";

describe("the canvas views", () => {
  it("is 2D, 3D and Tech pack, each with a label and a region name", () => {
    expect(CANVAS_VIEWS).toEqual(["2d", "3d", "tech-pack"]);
    expect(CANVAS_VIEWS.map((id) => VIEWS[id].label)).toEqual(["2D", "3D", "Tech pack"]);
    expect(VIEWS["tech-pack"].region).toBe("Tech pack view");
  });
});

describe("parseView", () => {
  it("takes the view the address names", () => {
    expect(parseView("3d")).toBe("3d");
    expect(parseView(["tech-pack"])).toBe("tech-pack");
  });

  it("falls back to the view the design opens in", () => {
    expect(parseView(null)).toBe(DEFAULT_VIEW);
    expect(parseView("hologram", "3d")).toBe("3d");
  });
});

describe("parseBeside", () => {
  it("takes a second view that is not the first", () => {
    expect(parseBeside("3d", "2d")).toBe("3d");
  });

  it("ignores a second view that is the first, or is not a view", () => {
    expect(parseBeside("2d", "2d")).toBeNull();
    expect(parseBeside("sideways", "2d")).toBeNull();
    expect(parseBeside(undefined, "2d")).toBeNull();
  });
});

describe("viewsShown", () => {
  it("is one view on its own", () => {
    expect(viewsShown("3d", null)).toEqual(["3d"]);
  });

  it("is two views in the toggle's own order, so the pair does not jump about", () => {
    expect(viewsShown("3d", "2d")).toEqual(["2d", "3d"]);
    expect(viewsShown("2d", "tech-pack")).toEqual(["2d", "tech-pack"]);
  });

  it("is one view when the second is the same", () => {
    expect(viewsShown("2d", "2d")).toEqual(["2d"]);
  });
});

describe("toggled", () => {
  it("shows the view asked for on its own", () => {
    expect(toggled("2d", "3d", "tech-pack", false)).toEqual({ main: "tech-pack", beside: null });
  });

  it("adds a view beside the one already there", () => {
    expect(toggled("2d", null, "3d", true)).toEqual({ main: "2d", beside: "3d" });
  });

  it("takes a view away again, leaving the other one", () => {
    expect(toggled("2d", "3d", "3d", true)).toEqual({ main: "2d", beside: null });
    expect(toggled("2d", "3d", "2d", true)).toEqual({ main: "3d", beside: null });
  });

  it("leaves the only view showing when it is the one taken away", () => {
    expect(toggled("2d", null, "2d", true)).toEqual({ main: "2d", beside: null });
  });
});

describe("showing", () => {
  it("is true for either view of a side-by-side canvas", () => {
    expect(showing("2d", "3d", "2d")).toBe(true);
    expect(showing("2d", "3d", "3d")).toBe(true);
    expect(showing("2d", "3d", "tech-pack")).toBe(false);
  });
});
