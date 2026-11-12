import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { acceptAsset, type Graph } from "@/lib/launch";
import { capabilityNotes, capabilityOf } from "../capabilities";
import { canvasOfTemplate, withBoard } from "../fixtures/canvas";
import { runFlow, type FlowRunRequest } from "../run";
import { STUB_COSTS, stubMeter, stubRecorder } from "../stub";
import { memoryPorts } from "../fixtures/real-ports";
import { layoutOfBoard } from "./marketing";
import { RECORDED_VIDEO_LINE } from "./mockup";
import { INFO_CARD_LINE, flowRegistry, registryNote } from "./registry";
import { sceneSeed } from "./scene";
import { NO_SERVER_FRAMES_LINE, videoCapability } from "./video";

/**
 * The registry a real run is handed (decision 0133). Everything that draws is real here; the only
 * doubles are a memory for the bucket and each paid adapter's own stub provider.
 */

const request = (over: Partial<FlowRunRequest> = {}): FlowRunRequest => ({
  boardId: "board-1",
  kind: "ai_image",
  name: "Board",
  generation: "model",
  settings: {},
  garment: { boardId: "design", designProjectId: "11111111-1111-4111-8111-111111111111", version: 3 },
  inputs: [],
  format: "png",
  ...over,
});

describe("the real registry", { timeout: 60_000 }, () => {
  it("registers a real capability for every kind a flow runs, so nothing is left to the stub", () => {
    const registry = flowRegistry({ boards: [], edges: [] }, memoryPorts().ports);
    const stubbed = capabilityNotes(registry).filter((note) => note.stubbed).map((note) => note.kind);
    // Design and artboard boards are never run: they are the garment and the empty page. Nor are the
    // one canvas's garment, tech pack and order boards (decision 0145): they are views of the design.
    expect(stubbed.sort()).toEqual(["artboard", "design", "garment", "order", "tech_pack"]);
  });

  it("says in the run panel's note which kinds are live", () => {
    expect(registryNote({ aiImage: false, aiVideo: false }, false)).toContain("AI scenes are not live (MEDIA_SHOOTS_LIVE is off)");
    expect(registryNote({ aiImage: true, aiVideo: false }, false)).toContain("AI scenes are live");
    expect(registryNote({ aiImage: false, aiVideo: true }, true)).toContain("AI clips are live");
    expect(registryNote({ aiImage: false, aiVideo: false }, true)).toContain("MEDIA_VIDEO_LIVE is off");
    expect(registryNote({ aiImage: false, aiVideo: false }, false)).toContain("Mockups and marketing posts are drawn by the platform");
  });

  it("draws a mockup board from the design behind it, as a picture the platform drew", async () => {
    const { graph } = canvasOfTemplate("shopify-product-listing");
    const memory = memoryPorts();
    const registry = flowRegistry(graph, memory.ports);
    const board = graph.boards.find((one) => one.kind === "mockup" && one.settings["scene"] === "flat-lay");
    if (!board) throw new Error("no flat lay");

    const outcome = await registry.byKind.mockup!.run(request({ boardId: board.id, kind: "mockup", generation: "deterministic", settings: board.settings }));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.asset.provenance).toBe("deterministic");
    expect(acceptAsset("mockup", outcome.asset).accepted).toBe(true);
    const stored = memory.files.get(outcome.asset.file.fileId);
    expect(stored?.provenance).toBe("deterministic");
    expect((await sharp(stored!.bytes).metadata()).format).toBe("png");
    // The version it was drawn from is written back, and the pack's own settings are not touched.
    expect(memory.versions).toEqual([{ boardId: board.id, version: 7 }]);
  });

  it("refuses a turntable in words rather than filing a still as a clip", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const registry = flowRegistry(graph, memoryPorts().ports);

    const outcome = await registry.byKind.mockup!.run(request({ boardId: "turntable", kind: "mockup", format: "mp4", settings: { scene: "turntable-360" } }));

    expect(outcome).toEqual({ ok: false, reason: RECORDED_VIDEO_LINE, ruleId: "R-GAP-000" });
  });

  it("lays a marketing post out with the drawn picture that feeds it and never a generated one", async () => {
    const memory = memoryPorts();
    const drawn = await memory.ports.mockup.store(new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer()));
    const generated = await memory.ports.scene.store(new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#abcdef" } }).png().toBuffer()));
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const read: string[] = [];
    const registry = flowRegistry(graph, {
      ...memory.ports,
      marketing: { ...memory.ports.marketing, read: async (fileId) => (read.push(fileId), memory.files.get(fileId)?.bytes ?? null) },
    });
    const post = graph.boards.find((one) => one.id === "post-square")!;

    const outcome = await registry.byKind.marketing!.run(
      request({
        boardId: post.id,
        kind: "marketing",
        generation: "deterministic",
        settings: post.settings,
        inputs: [
          { boardId: "render-front", inputIndex: 1, kind: "mockup", fileId: drawn.fileId, generated: false },
          { boardId: "line-up", inputIndex: 2, kind: "ai_image", fileId: generated.fileId, generated: true },
        ],
      }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.asset.provenance).toBe("deterministic");
    // The generated scene is not even read: it can never be part of the post's pixels.
    expect(read).toEqual([drawn.fileId]);
    const meta = await sharp(memory.files.get(outcome.asset.file.fileId)!.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([post.size.width, post.size.height]);
  });

  it("picks a layout of the post's own shape when the pack named none", () => {
    expect(layoutOfBoard({ aspect: "9:16" }, { width: 1080, height: 1920 })?.formats).toContain("story-9-16");
    expect(layoutOfBoard({ aspect: "4:5" }, { width: 1080, height: 1350 })?.formats).toContain("social-post-4-5");
    expect(layoutOfBoard({ preset: "a4-print" }, { width: 2480, height: 3508 })?.formats).toContain("a4-print");
  });

  it("runs an AI scene through L3's shoot with the adapter's stub, and labels it AI", async () => {
    const memory = memoryPorts();
    const registry = flowRegistry({ boards: [], edges: [] }, memory.ports);

    const outcome = await registry.byKind.ai_image!.run(request({ settings: { scene: "team-line-up-11", prompt: "Floodlit", aspect: "4:5" } }));

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.asset.provenance).toBe("generated");
    expect(outcome.asset.role).toBe("scene");
    expect(memory.files.get(outcome.asset.file.fileId)?.provenance).toBe("generated");
    // The usage meter was asked, as the shoot asks it, and a kept picture keeps its reservation.
    expect(memory.reservations.reserved.length).toBeGreaterThan(0);
    expect(memory.reservations.released).toEqual([]);
  });

  it("gives Remix a new seed and Regenerate the same one", () => {
    const first = request();
    expect(sceneSeed(first, 1)).toBe(sceneSeed(request(), 1));
    expect(sceneSeed(request({ settings: { remix: 1 } }), 1)).not.toBe(sceneSeed(first, 1));
  });

  it("refuses an AI clip before any model is asked while frames cannot be checked on the server", async () => {
    const memory = memoryPorts();

    const outcome = await videoCapability(memory.ports.video).run(request({ kind: "ai_video", format: "mp4" }));

    expect(outcome).toEqual({ ok: false, reason: NO_SERVER_FRAMES_LINE, ruleId: "R-GAP-000" });
    expect(memory.providerCalls.video).toBe(0);
    expect(memory.reservations.reserved).toEqual([]);
  });

  it("runs an AI clip through L5's run when a sampler and a store exist, and releases on a rejection", async () => {
    const memory = memoryPorts();
    const kept: Uint8Array[] = [];
    const capability = videoCapability({
      ...memory.ports.video,
      // The stub's clip has no picture frames, so a sampler finds none and the checker turns it away.
      sample: async () => [],
      store: async (video) => (kept.push(video), { fileId: "x", contentType: "video/webm" }),
    });

    const outcome = await capability.run(request({ kind: "ai_video", format: "mp4", settings: { preset: "slow-orbit", seconds: 6 } }));

    expect(outcome.ok).toBe(false);
    expect(memory.providerCalls.video).toBe(1);
    expect(memory.reservations.released).toEqual(memory.reservations.reserved);
    expect(kept).toEqual([]);
  });

  it("refuses an info card in words", async () => {
    const registry = flowRegistry({ boards: [], edges: [] }, memoryPorts().ports);
    expect(await registry.byKind.info_card!.run(request({ kind: "info_card" }))).toEqual({ ok: false, reason: INFO_CARD_LINE, ruleId: "R-GAP-000" });
  });
});

describe("a pack run through the real registry", { timeout: 120_000 }, () => {
  const runReal = async (graph: Graph) => {
    const memory = memoryPorts();
    const report = await runFlow(
      { capability: capabilityOf(flowRegistry(graph, memory.ports)), meter: stubMeter({ balance: 500 }), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );
    return { report, memory };
  };

  it("draws the colourway set's renders and posts for real, and names nothing that was not stored", async () => {
    const { graph } = canvasOfTemplate("colourway-set");
    const { report, memory } = await runReal(graph);

    expect(report.state).toBe("done");
    for (const line of report.lines) {
      expect(line.state, line.boardId).toBe("ready");
      expect(memory.files.has(line.fileId!), line.boardId).toBe(true);
    }
  });

  it("swapping the design version gives every drawn board a new file", async () => {
    const { graph } = canvasOfTemplate("colourway-set", { designVersion: 2 });
    const first = await runReal(graph);
    const second = await runReal(withBoard(graph, "design", { inputVersion: 3 }));
    expect(second.report.state).toBe("done");
    expect(second.memory.versions.every((one) => one.version === 3)).toBe(true);
    expect(first.memory.versions.every((one) => one.version === 2)).toBe(true);
  });
});
