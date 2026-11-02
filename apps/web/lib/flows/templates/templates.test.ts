import { describe, expect, it } from "vitest";
import { BOARDS, canConnect, garmentSource, type BoardLink, type BoardView, type Graph } from "@/lib/launch";
import { FLOW_FORMATS, GENERATIONS, type FlowTemplateSpec } from "../types";
import { assetsOf, FLOW_TEMPLATES, flowTemplate, notesOf, stepOf, stepsOfSection } from "./index";

/**
 * The six packs of `docs/spec/07-template-library.md`, held to what the spec says about them: the
 * count of assets, the steps, and -- the part that matters -- that each pack is a canvas L1's own
 * board table would let a person wire by hand. A pack that could not be drawn is a pack that would
 * be refused the moment somebody opened it.
 */

/** A pack as a canvas, so L1's own rules can be asked about it. */
function canvasOf(spec: FlowTemplateSpec): Graph {
  const boards: BoardView[] = spec.steps.map((one, at) => ({
    id: one.key,
    kind: one.kind,
    name: one.name,
    at: { x: at * 320, y: 0 },
    size: { width: 1080, height: 1080 },
    settings: one.settings,
    inputVersion: one.kind === "design" ? 1 : null,
    outputFileId: null,
    outputRole: "asset",
    status: "empty",
    lastCostCredits: null,
    ruleId: one.ruleId,
  }));
  const edges: BoardLink[] = spec.steps.flatMap((one) =>
    one.feeds.map((from, index) => ({ id: `${from}->${one.key}`, fromBoardId: from, toBoardId: one.key, inputIndex: index + 1 })),
  );
  return { boards, edges };
}

describe("the flow template library", () => {
  it("holds the six packs of 07, in the order it lists them", () => {
    expect(FLOW_TEMPLATES.map((one) => one.slug)).toEqual([
      "club-kit-launch-pack",
      "brand-drop-pack",
      "team-store-promo",
      "shopify-product-listing",
      "colourway-set",
      "sponsor-pack",
    ]);
  });

  it("gives every pack a slug, a sort and a note that says nobody has reviewed it", () => {
    for (const spec of FLOW_TEMPLATES) {
      expect(spec.slug, spec.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(spec.sort, spec.slug).toBe(FLOW_TEMPLATES.indexOf(spec) + 1);
      expect(spec.note, spec.slug).toContain("not reviewed by anyone");
      expect(spec.ruleId, spec.slug).toMatch(/^R-[A-Z]+-\d{3}$/);
    }
  });

  it("finds a pack by its slug and nothing by an invented one", () => {
    expect(flowTemplate("sponsor-pack")?.title).toBe("Sponsor pack");
    expect(flowTemplate("made-up-pack")).toBeNull();
  });
});

describe.each(FLOW_TEMPLATES.map((spec) => [spec.slug, spec] as const))("the %s pack", (slug, spec) => {
  it("makes exactly the number of assets 07 gives it", () => {
    expect(assetsOf(spec)).toBe(spec.assets);
  });

  it("starts from one Design board, which makes no asset of its own", () => {
    const designs = spec.steps.filter((one) => one.kind === "design");
    expect(designs).toHaveLength(1);
    expect(designs[0]!.key).toBe("design");
    expect(designs[0]!.assets).toBe(0);
    expect(designs[0]!.feeds).toEqual([]);
  });

  it("gives every other step at least one input and one asset", () => {
    for (const one of spec.steps.filter((each) => each.kind !== "design")) {
      expect(one.feeds.length, one.key).toBeGreaterThan(0);
      expect(one.assets, one.key).toBeGreaterThan(0);
    }
  });

  it("names every step it feeds from, and names each step once", () => {
    const keys = spec.steps.map((one) => one.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const one of spec.steps) for (const feed of one.feeds) expect(stepOf(spec, feed), `${one.key} <- ${feed}`).not.toBeNull();
  });

  it("puts every step under one of the pack's own yellow section labels", () => {
    for (const one of spec.steps) expect(spec.sections, one.key).toContain(one.section);
    expect(spec.sections.every((section) => stepsOfSection(spec, section).length > 0)).toBe(true);
  });

  it("carries a grey instruction note on the first step and on the last", () => {
    const notes = notesOf(spec);
    expect(notes.length).toBeGreaterThan(1);
    expect(notes[0]!.key).toBe("design");
    expect(notes[0]!.note).toContain("Run all");
    expect(notes.at(-1)!.note).toContain("Export all");
  });

  it("is a canvas the board table would let a person wire by hand", () => {
    const graph = canvasOf(spec);
    for (const edge of graph.edges) {
      const without = { boards: graph.boards, edges: graph.edges.filter((one) => one.id !== edge.id) };
      const verdict = canConnect(without, edge.fromBoardId, edge.toBoardId, edge.inputIndex);
      expect(verdict, `${edge.fromBoardId} -> ${edge.toBoardId}`).toEqual({ allowed: true });
    }
  });

  it("keeps the garment locked on every board, by a path back to the Design board", () => {
    const graph = canvasOf(spec);
    for (const board of graph.boards) {
      if (BOARDS[board.kind].maxInputs === 0) continue;
      expect(garmentSource(graph, board.id).locked, board.id).toBe(true);
    }
  });

  it("says of every step how it is made and what format it comes out as", () => {
    for (const one of spec.steps) {
      expect(GENERATIONS, one.key).toContain(one.generation);
      expect(FLOW_FORMATS, one.key).toContain(one.format);
      // A board the platform draws itself is never a board a model draws, and the other way round.
      if (one.kind === "ai_image" || one.kind === "ai_video") expect(one.generation, one.key).toBe("model");
      if (one.kind === "design" || one.kind === "artboard" || one.kind === "info_card") expect(one.generation, one.key).toBe("deterministic");
    }
  });

  it("has a tutorial card that does not pretend to have a film", () => {
    expect(spec.tutorial.title, slug).toContain("Watch tutorial");
    expect(spec.tutorial.url).toBeNull();
    expect(spec.tutorial.note).toContain("No tutorial film has been made yet");
  });

  it("saves every prompt, scene and aspect on the board, so a rerun types nothing again", () => {
    for (const one of spec.steps.filter((each) => each.kind !== "design")) {
      expect(Object.keys(one.settings).length, one.key).toBeGreaterThan(0);
    }
  });
});
