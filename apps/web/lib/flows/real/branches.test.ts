import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Graph } from "@/lib/launch";
import { buildLayouts } from "@/lib/marketing/templates/plans";
import { failingShootProvider } from "@/lib/shoots/stub";
import { canvasOfTemplate } from "../fixtures/canvas";
import { memoryPorts } from "../fixtures/real-ports";
import type { FlowRunRequest } from "../run";
import { layoutOfBoard, marketingCapability, NO_LAYOUT_LINE } from "./marketing";
import { mockupCapability } from "./mockup";
import { flowRegistry, registryNote } from "./registry";
import { NO_DESIGN_LINE, NO_REFERENCE_LINE, sceneCapability, sceneSeed } from "./scene";
import { cropOfSettings, mockupSettingsOf, sceneSlugOfBoard } from "./scenes";
import { NO_DESIGN_LINE as NO_VIDEO_DESIGN, NO_FRAME_LINE, videoCapability } from "./video";

/**
 * The refusals and fallbacks of the real capabilities (decision 0133): every door out of each one,
 * so a change to any of them is seen. The drawing itself is `registry.test.ts`'s.
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

const noDesign = { boardId: "design", designProjectId: null, version: null };

const png = async (): Promise<Uint8Array> => new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).png().toBuffer());

describe("the scene names", () => {
  it("reads only an aspect that is a crop, and a library slug a pack names directly", () => {
    expect(cropOfSettings({ aspect: "3:2" })).toBeNull();
    expect(cropOfSettings({ aspect: 4 })).toBeNull();
    expect(sceneSlugOfBoard({ scene: "folded-stack" })).toBe("folded-stack");
    expect(sceneSlugOfBoard({ scene: "ecommerce-white" })).toBe("ecommerce-white-square");
    expect(sceneSlugOfBoard({ scene: "ecommerce-white", aspect: "16:9" })).toBe("ecommerce-white-square");
  });

  it("leaves settings with no scene alone, and keeps a crop the board already chose", () => {
    const none = { aspect: "1:1" };
    expect(mockupSettingsOf(none)).toBe(none);
    expect(mockupSettingsOf({ scene: "render-front", aspect: "1:1", crop: "4:5" })).toMatchObject({ crop: "4:5", sceneSlug: "product-front" });
  });
});

describe("the mockup capability's refusals", () => {
  it("refuses a board that is no longer on the canvas and a board with no scene", async () => {
    const { graph } = canvasOfTemplate("shopify-product-listing");
    const capability = mockupCapability(graph, memoryPorts().ports.mockup);
    const flat = graph.boards.find((one) => one.kind === "mockup" && one.settings["scene"] === "flat-lay")!;
    const bare: Graph = { boards: graph.boards.map((one) => (one.id === flat.id ? { ...one, settings: {} } : one)), edges: graph.edges };

    expect(await capability.run(request({ boardId: "gone", kind: "mockup" }))).toMatchObject({ ok: false, reason: "That board is no longer on the canvas." });
    const outcome = await mockupCapability(bare, memoryPorts().ports.mockup).run(request({ boardId: flat.id, kind: "mockup" }));
    expect(outcome.ok).toBe(false);
  });

  it("passes the renderer's own refusal on when the design cannot be read", async () => {
    const { graph } = canvasOfTemplate("shopify-product-listing");
    const flat = graph.boards.find((one) => one.kind === "mockup" && one.settings["scene"] === "flat-lay")!;
    const ports = memoryPorts().ports.mockup;
    const capability = mockupCapability(graph, { ...ports, design: async () => null });
    expect(await capability.run(request({ boardId: flat.id, kind: "mockup" }))).toMatchObject({ ok: false });
  });
});

describe("the marketing capability's refusals and fallbacks", () => {
  it("picks a layout by size when the board names no aspect, and its own layout when it names one", () => {
    expect(layoutOfBoard({}, { width: 1000, height: 1000 })?.formats).toContain("social-square-1-1");
    expect(layoutOfBoard({}, { width: 1920, height: 1080 })?.formats).toContain("hero-banner-16-9");
    expect(layoutOfBoard({}, { width: 1080, height: 1350 })?.formats).toContain("social-post-4-5");
    expect(layoutOfBoard({ layoutKey: "home-away-split" }, { width: 1, height: 1 })?.key).toBe("home-away-split");
    expect(layoutOfBoard({ layoutKey: "no-such-layout" }, { width: 1, height: 1 })).toBeNull();
    expect(layoutOfBoard({ aspect: "1:1" }, { width: 1, height: 1 }, [])).toBeNull();
  });

  it("refuses a board that is gone and a post with no layout of its shape", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const capability = marketingCapability(graph, memoryPorts().ports.marketing);
    expect(await capability.run(request({ boardId: "gone", kind: "marketing" }))).toMatchObject({ ok: false });
    expect(await capability.run(request({ boardId: "post-square", kind: "marketing", settings: { layoutKey: "no-such-layout" } }))).toEqual({
      ok: false,
      reason: NO_LAYOUT_LINE,
      ruleId: "R-GAP-000",
    });
  });

  it("draws a board's own words, leaves an unreadable picture's slot empty, and caps a huge board", async () => {
    const memory = memoryPorts();
    const layout = buildLayouts().find((one) => one.key === "home-away-split")!;
    const text = layout.slots.find((slot) => slot.kind === "text")!;
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const huge: Graph = { boards: graph.boards.map((one) => (one.id === "post-square" ? { ...one, size: { width: 8000, height: 8000 } } : one)), edges: graph.edges };
    const drawn = await memory.ports.mockup.store(await png());

    const outcome = await marketingCapability(huge, { ...memory.ports.marketing, read: async () => null }).run(
      request({
        boardId: "post-square",
        kind: "marketing",
        settings: { layoutKey: "home-away-split", words: { [text.id]: "Home" } },
        inputs: [
          { boardId: "a", inputIndex: 1, kind: "mockup", fileId: drawn.fileId, generated: false },
          { boardId: "b", inputIndex: 2, kind: "mockup", fileId: null, generated: false },
        ],
      }),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const meta = await sharp(memory.files.get(outcome.asset.file.fileId)!.bytes).metadata();
    expect(meta.width).toBe(4096);
  });
});

describe("the AI scene capability's refusals", () => {
  it("refuses a board with no design, and a design that cannot be drawn", async () => {
    const ports = memoryPorts().ports.scene;
    expect(await sceneCapability(ports).run(request({ garment: noDesign }))).toEqual({ ok: false, reason: NO_DESIGN_LINE, ruleId: "R-GAP-000" });
    expect(await sceneCapability({ ...ports, reference: async () => null }).run(request())).toEqual({ ok: false, reason: NO_REFERENCE_LINE, ruleId: "R-GAP-000" });
  });

  it("passes a model's refusal on in the shoot's own words, and stores nothing", async () => {
    const memory = memoryPorts();
    const capability = sceneCapability({ ...memory.ports.scene, provider: () => ({ provider: failingShootProvider("no"), live: true }) });

    const outcome = await capability.run(request({ settings: { prompt: "A street", showsPerson: true } }));

    expect(outcome.ok).toBe(false);
    expect([...memory.files.values()].some((file) => file.provenance === "generated")).toBe(false);
    expect(memory.reservations.released).toEqual(memory.reservations.reserved);
  });

  it("reads a remix count that is not a number as no remix", () => {
    expect(sceneSeed(request({ settings: { remix: "two" } }), 1)).toBe(sceneSeed(request(), 1));
  });
});

describe("the AI clip capability", () => {
  const withSampler = (ports: ReturnType<typeof memoryPorts>["ports"]["video"]) => ({
    ...ports,
    sample: async () => [],
    store: async () => ({ fileId: "clip", contentType: "video/webm" }),
  });

  it("refuses a board with no design, and a design that cannot be drawn", async () => {
    const ports = withSampler(memoryPorts().ports.video);
    expect(await videoCapability(ports).run(request({ kind: "ai_video", garment: noDesign }))).toEqual({ ok: false, reason: NO_VIDEO_DESIGN, ruleId: "R-GAP-000" });
    expect(await videoCapability({ ...ports, firstFrame: async () => null }).run(request({ kind: "ai_video" }))).toEqual({ ok: false, reason: NO_FRAME_LINE, ruleId: "R-GAP-000" });
  });

  it("keeps a clip whose every frame passed, as an AI scene", async () => {
    const memory = memoryPorts();
    // The frames are the first frame itself, so nothing drifts.
    const frame = await memory.ports.video.firstFrame("x", 1);
    const kept = videoCapability({
      ...withSampler(memory.ports.video),
      sample: async (_video, atMs) => atMs.map((at) => ({ atMs: at, png: frame!.png })),
    });

    const outcome = await kept.run(request({ kind: "ai_video", format: "mp4", settings: { presetKey: "slow-orbit", seconds: 5 } }));

    expect(outcome).toMatchObject({ ok: true, asset: { provenance: "generated", role: "scene", file: { fileId: "clip" } } });
  });

  it("says in the registry's note that clips are runnable once a sampler and a store exist", () => {
    const memory = memoryPorts();
    const registry = flowRegistry({ boards: [], edges: [] }, { ...memory.ports, video: withSampler(memory.ports.video), live: { aiImage: true, aiVideo: true } });
    expect(registry.note).toBe(registryNote({ aiImage: true, aiVideo: true }, true));
    expect(registry.note).toContain("AI clips are live");
  });
});
