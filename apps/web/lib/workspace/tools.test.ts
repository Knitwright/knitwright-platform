import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOL,
  JOURNEY_TOOLS,
  RAIL_TOOLS,
  TOOLS,
  journeySteps,
  parseTool,
  railKeyTarget,
  toolForSection,
  toolHref,
  withSearchParam,
} from "./tools";

const ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

describe("the tools of the design workspace", () => {
  it("puts one tool on the rail for each group of controls, in the order a design is usually made", () => {
    expect(RAIL_TOOLS).toEqual(["garment", "colours", "sizes", "fabric", "logos", "names", "labels", "history"]);
  });

  it("opens the share, photoreal and quote panels from the header, not the rail", () => {
    expect(JOURNEY_TOOLS).toEqual(["share", "photoreal", "quote"]);
    for (const id of JOURNEY_TOOLS) expect(RAIL_TOOLS).not.toContain(id);
  });

  it("gives every tool a short rail label, a panel title and at least one section", () => {
    for (const tool of Object.values(TOOLS)) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.label.length).toBeLessThanOrEqual(8);
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.sections.length).toBeGreaterThan(0);
    }
  });

  it("shows each section in exactly one tool", () => {
    const all = Object.values(TOOLS).flatMap((tool) => tool.sections);
    expect(new Set(all).size).toBe(all.length);
  });

  it("finds the tool that holds a section", () => {
    expect(toolForSection("measurements")).toBe("sizes");
    expect(toolForSection("options")).toBe("garment");
    expect(toolForSection("kit-styles")).toBe("colours");
    expect(toolForSection("artwork")).toBe("logos");
    expect(toolForSection("quote")).toBe("quote");
  });

  it("names nothing settled or approved", () => {
    const words = Object.values(TOOLS).map((tool) => `${tool.label} ${tool.title} ${tool.lead}`).join(" ");
    expect(words).not.toMatch(/\b(checked|approved|confirmed|final|verified)\b/i);
  });
});

describe("reading the open tool from the address", () => {
  it("opens the tool the address names", () => {
    expect(parseTool("sizes")).toBe("sizes");
    expect(parseTool("share")).toBe("share");
  });

  it("opens the garment tool when the address names none, or one that does not exist", () => {
    expect(DEFAULT_TOOL).toBe("garment");
    expect(parseTool(undefined)).toBe("garment");
    expect(parseTool(null)).toBe("garment");
    expect(parseTool("")).toBe("garment");
    expect(parseTool("SIZES")).toBe("garment");
    expect(parseTool("__proto__")).toBe("garment");
    expect(parseTool("toString")).toBe("garment");
  });

  it("takes the first value when the name is given twice", () => {
    expect(parseTool(["logos", "sizes"])).toBe("logos");
    expect(parseTool([])).toBe("garment");
  });
});

describe("writing the open tool into the address", () => {
  it("links to a tool of a design", () => {
    expect(toolHref(ID, "share")).toBe(`/studio/${ID}?tool=share`);
    expect(toolHref("a b", "sizes")).toBe("/studio/a%20b?tool=sizes");
  });

  it("keeps the other parts of the address, such as the colourway", () => {
    expect(withSearchParam("?colourway=away", "tool", "logos")).toBe("?colourway=away&tool=logos");
    expect(withSearchParam("colourway=away&tool=sizes", "tool", "logos")).toBe("?colourway=away&tool=logos");
    expect(withSearchParam("", "tool", "logos")).toBe("?tool=logos");
    expect(withSearchParam("?tool=logos", "colourway", "home kit")).toBe("?tool=logos&colourway=home+kit");
  });
});

describe("moving along the rail with the keyboard", () => {
  it("moves to the next tool with the down and right arrows, and wraps round", () => {
    expect(railKeyTarget("garment", "ArrowDown")).toBe("colours");
    expect(railKeyTarget("garment", "ArrowRight")).toBe("colours");
    expect(railKeyTarget("history", "ArrowDown")).toBe("garment");
  });

  it("moves to the previous tool with the up and left arrows, and wraps round", () => {
    expect(railKeyTarget("colours", "ArrowUp")).toBe("garment");
    expect(railKeyTarget("colours", "ArrowLeft")).toBe("garment");
    expect(railKeyTarget("garment", "ArrowUp")).toBe("history");
  });

  it("jumps to the first and last tools with Home and End", () => {
    expect(railKeyTarget("sizes", "Home")).toBe("garment");
    expect(railKeyTarget("sizes", "End")).toBe("history");
  });

  it("starts from the first tool when a header panel is open", () => {
    expect(railKeyTarget("share", "ArrowDown")).toBe("garment");
  });

  it("leaves every other key alone", () => {
    expect(railKeyTarget("sizes", "Enter")).toBeNull();
    expect(railKeyTarget("sizes", "a")).toBeNull();
  });
});

describe("the four steps of the journey in the header", () => {
  it("goes design, factory file, committee, quote", () => {
    expect(journeySteps(ID, "garment").map((step) => step.label)).toEqual(["Design", "Factory file", "Committee", "Quote"]);
  });

  it("links each step to its place", () => {
    expect(journeySteps(ID, "garment").map((step) => step.href)).toEqual([
      `/studio/${ID}?tool=garment`,
      `/studio/${ID}/tech-pack`,
      `/studio/${ID}?tool=share`,
      `/studio/${ID}?tool=quote`,
    ]);
  });

  it("marks the step of the open tool as the current one", () => {
    const current = (tool: Parameters<typeof journeySteps>[1]) =>
      journeySteps(ID, tool).filter((step) => step.current).map((step) => step.id);
    expect(current("sizes")).toEqual(["design"]);
    expect(current("photoreal")).toEqual(["design"]);
    expect(current("share")).toEqual(["committee"]);
    expect(current("quote")).toEqual(["quote"]);
  });

  it("opens the share and quote steps in the workspace, and the factory file on its own page", () => {
    const tools = journeySteps(ID, "garment").map((step) => step.tool);
    expect(tools).toEqual(["garment", null, "share", "quote"]);
  });
});
