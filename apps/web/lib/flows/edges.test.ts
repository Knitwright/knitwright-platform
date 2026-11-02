import { describe, expect, it } from "vitest";
import type { BoardKind, BoardLink, BoardView, Graph } from "@/lib/launch";
import { artworkVerdict, roleWanted } from "./artwork";
import { connectorsOf, inputDot } from "./canvas";
import { estimateFlow } from "./cost";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { infoCard } from "./info-card";
import { listingPayload } from "./listing";
import { operationsFor, planOperation } from "./operations";
import { runFlow } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";
import { runSummary } from "./summary";
import { notesOf, SPONSOR_PACK, stepsOfSection } from "./templates";
import { FLOW_GAP_RULE } from "./types";
import { exportPaths, flowZip } from "./zip";

/**
 * The odd paths: a board with no name, a graph with a board missing, an asset with no provenance a
 * person would recognise. None of them should happen, every one of them can come out of a database
 * row somebody wrote by hand, and a screen that falls over on one is a screen that falls over.
 */

const board = (id: string, kind: BoardKind, over: Partial<BoardView> = {}): BoardView => ({
  id,
  kind,
  name: "",
  at: { x: 0, y: 0 },
  size: { width: 1080, height: 1080 },
  settings: {},
  inputVersion: null,
  outputFileId: null,
  outputRole: "asset",
  status: "empty",
  lastCostCredits: null,
  ruleId: "",
  ...over,
});

const link = (from: string, to: string, inputIndex = 1): BoardLink => ({ id: `${from}->${to}`, fromBoardId: from, toBoardId: to, inputIndex });

describe("a board with no name of its own", () => {
  it("is called by its kind on a connector and in the connect list", () => {
    const graph: Graph = { boards: [board("a", "mockup"), board("b", "marketing")], edges: [link("a", "b")] };

    expect(connectorsOf(graph)[0]?.label).toBe("Mockup feeds input 1 of Marketing");
  });

  it("is called an AI board in the refusal when it has no name of its own", () => {
    const graph: Graph = { boards: [board("scene", "ai_image", { name: "" }), board("post", "marketing")], edges: [link("scene", "post")] };
    const verdict = artworkVerdict(graph, "post", "print_file");

    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed ? "" : verdict.reason).toContain("an AI board");
  });
});

describe("the odd corners of the maths", () => {
  it("keeps an input dot on the board even when the index is below the first", () => {
    const post = board("post", "marketing");

    expect(inputDot(post, 0)).toEqual(inputDot(post, 1));
  });

  it("reads a generated asset as asking for nothing but an asset, whatever it says it is", () => {
    const graph: Graph = { boards: [board("scene", "ai_image")], edges: [] };
    const generated = {
      role: "scene",
      provenance: "generated",
      file: { fileId: "f", contentType: "image/png" },
      label: "AI-generated",
      showsPerson: false,
    } as const;

    expect(roleWanted(graph, "scene", generated)).toEqual({ role: "asset", verdict: { allowed: true } });
  });

  it("falls back to the board's own rule when a board carries none", () => {
    const graph: Graph = { boards: [board("design", "design"), board("one", "mockup")], edges: [link("design", "one")] };

    expect(estimateFlow(graph, { from: "one", scope: "board" }, STUB_COSTS).lines[0]?.ruleId).toBe(FLOW_GAP_RULE);
  });
});

describe("the summary of a board that is no longer there", () => {
  it("still draws a line for it, with no label", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    const summary = runSummary({ boards: [], edges: [] }, report);

    expect(summary.rows).toHaveLength(4);
    expect(summary.rows.every((row) => row.label === null)).toBe(true);
  });

  it("labels a scene with a person in it as an AI-generated model", async () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    const withPerson = withBoard(graph, "lifestyle-city", { settings: { generation: "model", showsPerson: true } });
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter({ balance: 50 }), recorder: stubRecorder() },
      withPerson,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(runSummary(withPerson, report).rows.find((row) => row.boardId === "lifestyle-city")?.label).toBe("AI-generated model");
  });
});

describe("the odd corners of the hand-offs", () => {
  it("sorts two outputs of one format by name and then by board, so a zip is the same every time", () => {
    const one = { boardId: "b", name: "Same name", format: "png" as const, bytes: new Uint8Array([1]), label: null };
    const two = { boardId: "a", name: "Same name", format: "png" as const, bytes: new Uint8Array([2]), label: null };

    expect(exportPaths([one, two]).map((file) => file.boardId)).toEqual(["a", "b"]);
    expect(flowZip([one, two])).toEqual(flowZip([two, one]));
  });

  it("gives a listing payload with nothing in it when nothing has run", () => {
    const { graph } = canvasOfTemplate("colourway-set");
    const payload = listingPayload(graph, { launchProjectId: "p", title: "t", designProjectId: null, designVersion: null });

    expect(payload.media).toEqual([]);
  });

  it("reframes to the board's own size when the preset has gone between the check and the plan", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const ready = withBoard(graph, "render-front", { status: "ready", outputFileId: "55555555-0000-4000-8000-555555555555" });
    const offers = operationsFor({ graph: ready, board: ready.boards[0]!, source: STUB_COSTS, presets: [] });

    expect(offers.find((one) => one.id === "reframe")?.blocked).not.toBeNull();
    expect(planOperation("reframe", { graph: ready, board: ready.boards[0]!, source: STUB_COSTS, presets: [] })).toBeNull();
  });

  it("writes a care card in inches as readily as in centimetres", () => {
    expect(infoCard("care_card", { sizes: [], measures: [], colours: [], fabrics: [], features: [], care: [{ label: "Dry", words: "Line dry", ruleId: "R-CARE-002" }] }, "in").missing).toBe(0);
  });
});

describe("the template library's own lookups", () => {
  it("gives nothing for a section no pack has, and the notes of one that has them", () => {
    expect(stepsOfSection(SPONSOR_PACK, "made up")).toEqual([]);
    expect(notesOf(SPONSOR_PACK).map((one) => one.key)).toContain("design");
    expect(notesOf({ ...SPONSOR_PACK, steps: SPONSOR_PACK.steps.map((one) => ({ ...one, note: null })) })).toEqual([]);
  });
});
