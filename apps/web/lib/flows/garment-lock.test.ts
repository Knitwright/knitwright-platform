import { describe, expect, it } from "vitest";
import { acceptAsset, type BoardKind, type BoardLink, type BoardView, type Graph, type LaunchAsset } from "@/lib/launch";
import { artworkVerdict, carriesGenerated, generatedUpstream, roleWanted } from "./artwork";
import { runFlow } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";
import { FLOW_GAP_RULE } from "./types";

/**
 * A FLOW IS THE EASIEST PLACE TO LAUNDER A GENERATED PICTURE INTO ARTWORK, SO THIS IS WHERE IT IS
 * PROVED IMPOSSIBLE (spec decision 13, principle 4; plan v5 wave 4 preamble).
 *
 * The attack is four hops long and uses nothing but boards the spec allows:
 *
 *     Design  ->  Mockup  ->  AI image  ->  AI image  ->  Marketing  -> "print file, please"
 *
 * Every board in that chain is legal. The Marketing board at the end is a board the platform draws
 * itself, so L1's three doors -- the asset union, `acceptAsset` and the schema's own constraint --
 * all let its output be a print file: each of them asks about the board's own kind, and this board's
 * kind is innocent. The pixels, however, came through two AI boards.
 *
 * `lib/flows/artwork.ts` asks the question of the whole branch instead, the run refuses the output
 * and gives the credits back, and the flow migration puts the same rule on `public.boards` as a
 * trigger so a write that never touches this code is refused as well
 * (`tests/integration/flows.test.ts`).
 */

const board = (id: string, kind: BoardKind, over: Partial<BoardView> = {}): BoardView => ({
  id,
  kind,
  name: id,
  at: { x: 0, y: 0 },
  size: { width: 1080, height: 1080 },
  settings: {},
  inputVersion: kind === "design" ? 4 : null,
  outputFileId: kind === "design" ? null : "99999999-0000-4000-8000-999999999999",
  outputRole: "asset",
  status: kind === "design" ? "empty" : "ready",
  lastCostCredits: null,
  ruleId: FLOW_GAP_RULE,
  ...over,
});

const link = (from: string, to: string, inputIndex = 1): BoardLink => ({ id: `${from}->${to}`, fromBoardId: from, toBoardId: to, inputIndex });

/** The four-hop chain, with a Marketing board at the end that would like to be a print file. */
const chain = (): Graph => ({
  boards: [
    board("design", "design"),
    board("mockup", "mockup"),
    board("scene", "ai_image"),
    board("scene-again", "ai_image"),
    board("post", "marketing"),
  ],
  edges: [link("design", "mockup"), link("mockup", "scene"), link("scene", "scene-again"), link("scene-again", "post")],
});

/** A picture the platform drew, offered as part of a print file. Honest on its own; not here. */
const printFile = (): LaunchAsset => ({
  role: "print_file",
  provenance: "deterministic",
  file: { fileId: "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa", contentType: "image/png" },
});

describe("what a chain of boards carries", () => {
  it("finds every AI board behind a board, however many hops away", () => {
    const graph = chain();

    expect(generatedUpstream(graph, "post")).toEqual(["scene-again", "scene"]);
    expect(generatedUpstream(graph, "mockup")).toEqual([]);
    expect(carriesGenerated(graph, "post")).toBe(true);
    expect(carriesGenerated(graph, "mockup")).toBe(false);
  });

  it("lets a board with nothing generated behind it be artwork, and refuses one with something", () => {
    const graph = chain();

    expect(artworkVerdict(graph, "mockup", "print_file")).toEqual({ allowed: true });
    expect(artworkVerdict(graph, "mockup", "panel_layer")).toEqual({ allowed: true });
    expect(artworkVerdict(graph, "post", "asset")).toEqual({ allowed: true });
    for (const role of ["print_file", "panel_layer"] as const) {
      const verdict = artworkVerdict(graph, "post", role);
      expect(verdict.allowed, role).toBe(false);
      expect(verdict.allowed ? "" : verdict.reason).toContain("nothing a model made becomes a layer on the garment");
      expect(verdict.allowed ? "" : verdict.ruleId).toBe(FLOW_GAP_RULE);
    }
  });

  it("says what a picture is asking for and refuses it, rather than quietly giving it a lesser role", () => {
    const graph = chain();
    const onPost = roleWanted(graph, "post", printFile());
    const onMockup = roleWanted(graph, "mockup", printFile());

    expect(onPost.role).toBe("print_file");
    expect(onPost.verdict.allowed).toBe(false);
    expect(onMockup).toEqual({ role: "print_file", verdict: { allowed: true } });
  });

  it("is not confused by a loop written straight into the database", () => {
    const graph: Graph = {
      boards: [board("one", "ai_image"), board("two", "marketing")],
      edges: [link("one", "two"), link("two", "one")],
    };

    expect(generatedUpstream(graph, "two")).toEqual(["one"]);
  });
});

describe("a four-hop flow trying to make a generated picture into artwork", () => {
  const runChain = async (asset: () => LaunchAsset) => {
    const recorder = stubRecorder();
    const meter = stubMeter({ balance: 50 });
    const report = await runFlow(
      { capability: stubCapability({ asset }), meter, recorder },
      chain(),
      { from: "post", scope: "board" },
      STUB_COSTS,
    );
    return { report, recorder, meter };
  };

  it("is refused at the last hop, and the board says so rather than quietly becoming an asset", async () => {
    const { report, recorder } = await runChain(printFile);
    const post = report.lines.find((one) => one.boardId === "post");

    expect(post?.state).toBe("failed");
    expect(post?.reason).toContain("nothing a model made becomes a layer on the garment");
    expect(recorder.written.filter((one) => one.status === "ready")).toEqual([]);
    expect(recorder.written.at(-1)).toEqual({ boardId: "post", status: "failed", credits: 0, fileId: null, role: null });
  });

  it("cannot put a generated picture on a board the platform draws itself either", async () => {
    const generated = (): LaunchAsset => ({
      role: "scene",
      provenance: "generated",
      file: { fileId: "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb", contentType: "image/png" },
      label: "AI-generated",
      showsPerson: false,
    });
    const { report } = await runChain(generated);

    expect(report.lines[0]?.state).toBe("failed");
    expect(report.lines[0]?.reason).toContain("cannot hold a generated picture");
  });

  it("records nothing, charges nothing in the end, and says what it cost", async () => {
    const { report, meter } = await runChain(printFile);

    expect(report.spent).toBe(0);
    expect(meter.balance()).toBe(50);
    expect(report.state).toBe("failed");
  });

  it("still lets the same chain finish as scenery, which is what the spec asks for", async () => {
    const recorder = stubRecorder();
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter({ balance: 50 }), recorder },
      chain(),
      { from: "post", scope: "board" },
      STUB_COSTS,
    );

    expect(report.lines[0]?.state).toBe("ready");
    expect(recorder.written.at(-1)?.role).toBe("scene");
  });

  it("agrees with L1's own door on every pair of kind and asset", () => {
    // Belt and braces: the branch check never contradicts `acceptAsset`, it only narrows it.
    for (const kind of ["mockup", "marketing", "info_card"] as const) {
      expect(acceptAsset(kind, printFile())).toEqual({ accepted: true, role: "print_file" });
    }
    for (const kind of ["ai_image", "ai_video"] as const) {
      expect(acceptAsset(kind, printFile()).accepted).toBe(false);
    }
  });
});
