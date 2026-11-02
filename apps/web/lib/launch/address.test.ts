import { describe, expect, it } from "vitest";
import { DEFAULT_ZOOM, readAddress, withLaunchState, type LaunchState } from "./index";

const state: LaunchState = { rail: "mockups", boardId: "board-1", image: false, tool: "pen", unit: "mm", zoom: DEFAULT_ZOOM };

describe("reading the shell's state out of the address", () => {
  it("takes the panel, the board, the tool, the unit and the zoom", () => {
    expect(readAddress({ panel: "brand", board: "board-7", image: "1", tool: "text", unit: "in", zoom: "150" })).toEqual({
      rail: "brand",
      boardId: "board-7",
      image: true,
      tool: "text",
      unit: "in",
      zoom: 150,
    });
  });

  it("falls back for everything the address does not name", () => {
    expect(readAddress({})).toEqual({ rail: "templates", boardId: null, image: false, tool: "select", unit: null, zoom: DEFAULT_ZOOM });
  });

  it("leaves the unit unset when the address does not name one, so the project's own is used", () => {
    expect(readAddress({ unit: "furlongs" }).unit).toBe("px");
    expect(readAddress({}).unit).toBeNull();
  });

  it("holds the zoom inside its range and ignores one that is not a number", () => {
    expect(readAddress({ zoom: "9999" }).zoom).toBe(400);
    expect(readAddress({ zoom: "nonsense" }).zoom).toBe(DEFAULT_ZOOM);
  });

  it("refuses a board id that is not a plain identifier, so nothing in it can be read as markup", () => {
    expect(readAddress({ board: "<script>" }).boardId).toBeNull();
    expect(readAddress({ board: "a".repeat(65) }).boardId).toBeNull();
    expect(readAddress({ board: ["board-2", "board-3"] }).boardId).toBe("board-2");
  });
});

describe("writing the shell's state into the address", () => {
  it("keeps every other parameter and replaces its own", () => {
    const query = withLaunchState("?colourway=home&panel=text", state);

    expect(query).toContain("colourway=home");
    expect(query).toContain("panel=mockups");
    expect(query).toContain("unit=mm");
    expect(query).toContain("board=board-1");
  });

  it("leaves out the default zoom, so a plain link stays short", () => {
    expect(withLaunchState("", state)).not.toContain("zoom=");
    expect(withLaunchState("", { ...state, zoom: 150 })).toContain("zoom=150");
  });

  it("writes the picture flag only with a board selected", () => {
    expect(withLaunchState("", { ...state, image: true })).toContain("image=1");
    expect(withLaunchState("", { ...state, boardId: null, image: true })).not.toContain("image=1");
    expect(withLaunchState("?board=old&image=1", { ...state, boardId: null })).not.toContain("board=");
  });

  it("reads back exactly what it wrote", () => {
    const query = new URLSearchParams(withLaunchState("", { ...state, zoom: 200 }));
    expect(readAddress(Object.fromEntries(query))).toEqual({ ...state, zoom: 200 });
  });
});
