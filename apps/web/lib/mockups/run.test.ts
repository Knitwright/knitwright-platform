import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { board, designBoard, link } from "@/lib/launch/fixtures/canvas";
import { acceptAsset, type BoardStatus, type BoardView, type Graph, type LaunchAsset } from "@/lib/launch";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import { AI_SCENE_REFUSED } from "./compose";
import { NO_DRAWING_LINE } from "./garment";
import { CHART_SCENE_LINE, NO_DESIGN_LINE, NO_SCENE_LINE, UNREADABLE_LINE, renderMockupBoard, type DesignToDraw, type RenderDeps } from "./run";
import { settingsToStored } from "./board";
import { sceneBySlug } from "./scenes";

/**
 * THE RENDERER-TO-RUN LOOP (the wiring of decision 0092).
 *
 * Every read, store and write is a double, so this draws real pictures with `sharp` and touches no
 * database and no bucket. What is checked is not the pixels -- `render.test.ts` does that -- but
 * **who is asked what, in which order, and what is written down at the end**:
 *
 *   * a board with no Design board behind it is refused before anything is drawn;
 *   * what reaches L1's one writer is a drawn asset, and `acceptAsset` is asked the same question
 *     here so this loop cannot drift away from the lock it is meant to respect;
 *   * the board records the design version it was drawn from, so a later version reads as stale.
 */

const design = (): GarmentSpec => start("crew-tee") as unknown as GarmentSpec;

type Written = { readonly boardId: string; readonly kind: BoardView["kind"]; readonly asset: LaunchAsset | null; readonly status: BoardStatus; readonly credits: number | null };

function doubles(over: Partial<RenderDeps> = {}) {
  const written: Written[] = [];
  const stored: number[] = [];
  const versions: { boardId: string; version: number }[] = [];
  const deps: RenderDeps = {
    design: async (): Promise<DesignToDraw | null> => ({ spec: design(), charts: DEFAULT_CHART_SET, images: new Map(), version: 4 }),
    store: async (png) => {
      stored.push(png.byteLength);
      return { fileId: "11111111-1111-4111-8111-111111111111", contentType: "image/png" };
    },
    record: async (input) => {
      written.push(input);
    },
    setInputVersion: async (one, version) => {
      versions.push({ boardId: one.id, version });
    },
    ...over,
  };
  return { deps, written, stored, versions };
}

/** A mockup board on the smallest picture worth drawing, fed by a design board. */
const canvas = (slug = "flat-lay-white", extra: Partial<BoardView> = {}): Graph => {
  const scene = sceneBySlug(slug);
  if (!scene) throw new Error(`no scene ${slug}`);
  const mockup = board("mockup-1", "mockup", {
    settings: settingsToStored({ sceneSlug: slug, crop: scene.crops[0] ?? "1:1", kitRole: "home", colourwayId: null, roster: null, edge: 128 }),
    ...extra,
  });
  return { boards: [designBoard("design-1", "project-1", 3), mockup], edges: [link("edge-1", "design-1", "mockup-1")] };
};

describe("drawing a mockup board", () => {
  it("draws the design behind it, stores the picture and records a drawn asset", async () => {
    const { deps, written, stored, versions } = doubles();

    const outcome = await renderMockupBoard(deps, canvas(), "mockup-1");

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.width).toBeGreaterThan(0);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toBeGreaterThan(0);
    expect(written).toHaveLength(1);
    expect(written[0]?.status).toBe("ready");
    // Free: a deterministic mockup is drawn by this platform, so no credit is recorded against it.
    expect(written[0]?.credits).toBeNull();
    // The version the picture was drawn from, so `staleAgainst` can see a newer one later.
    expect(versions).toEqual([{ boardId: "mockup-1", version: 4 }]);
  });

  it("hands the writer a picture the platform drew, which L1's own door accepts as artwork", async () => {
    const { deps, written } = doubles();

    await renderMockupBoard(deps, canvas(), "mockup-1");
    const asset = written[0]?.asset;

    expect(asset).toBeTruthy();
    if (!asset) return;
    expect(asset.provenance).toBe("deterministic");
    expect(asset.role).toBe("scene");
    expect(acceptAsset("mockup", asset)).toEqual({ accepted: true, role: "asset" });
  });

  it("hands back what the picture cannot show yet, so the panel can say it rather than look finished", async () => {
    const { deps } = doubles();

    const outcome = await renderMockupBoard(deps, canvas("product-three-quarter"), "mockup-1");

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.gaps.join(" ")).toMatch(/turned/i);
    expect(outcome.notes.length).toBeGreaterThan(0);
  });

  it("refuses a board with no Design board behind it, and draws nothing", async () => {
    const { deps, stored, written } = doubles();
    const alone = canvas();
    const graph: Graph = { boards: alone.boards, edges: [] };

    const outcome = await renderMockupBoard(deps, graph, "mockup-1");

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toMatch(/Connect a board into this Mockup board first/);
    expect(stored).toEqual([]);
    expect(written).toEqual([]);
  });

  it("refuses a Design board whose design nobody chose", async () => {
    const { deps } = doubles();
    const graph: Graph = {
      boards: [board("design-1", "design"), canvas().boards[1] as BoardView],
      edges: [link("edge-1", "design-1", "mockup-1")],
    };

    expect(await renderMockupBoard(deps, graph, "mockup-1")).toMatchObject({ ok: false, reason: NO_DESIGN_LINE });
  });

  it("refuses a board that is not a mockup board", async () => {
    const { deps } = doubles();

    expect(await renderMockupBoard(deps, canvas(), "design-1")).toMatchObject({ ok: false, reason: "That is not a mockup board." });
    expect(await renderMockupBoard(deps, canvas(), "nobody")).toMatchObject({ ok: false, reason: "That is not a mockup board." });
  });

  it("refuses a board with no scene on it yet", async () => {
    const { deps } = doubles();
    const graph = canvas();
    const bare = { ...(graph.boards[1] as BoardView), settings: {} };

    expect(await renderMockupBoard(deps, { ...graph, boards: [graph.boards[0] as BoardView, bare] }, "mockup-1")).toMatchObject({
      ok: false,
      reason: NO_SCENE_LINE,
    });
  });

  it("refuses an AI scene, because this half of F-L1 makes no paid call", async () => {
    const { deps, stored } = doubles();

    expect(await renderMockupBoard(deps, canvas("team-line-up-five"), "mockup-1")).toMatchObject({ ok: false, reason: AI_SCENE_REFUSED });
    expect(stored).toEqual([]);
  });

  it("refuses a chart scene rather than drawing a card with nothing in it", async () => {
    const { deps } = doubles();

    expect(await renderMockupBoard(deps, canvas("size-chart-card"), "mockup-1")).toMatchObject({ ok: false, reason: CHART_SCENE_LINE });
  });

  it("says so when the design version cannot be read", async () => {
    const { deps, stored } = doubles({ design: async () => null });

    expect(await renderMockupBoard(deps, canvas(), "mockup-1")).toMatchObject({ ok: false, reason: UNREADABLE_LINE });
    expect(stored).toEqual([]);
  });

  it("says so when the platform has no drawing of this garment type", async () => {
    const { deps } = doubles({
      design: async () => ({ spec: { ...design(), typeId: "nothing-we-draw" } as unknown as GarmentSpec, charts: DEFAULT_CHART_SET, images: new Map(), version: 1 }),
    });

    expect(await renderMockupBoard(deps, canvas(), "mockup-1")).toMatchObject({ ok: false, reason: NO_DRAWING_LINE });
  });

  it("draws the colourway whose name matches the board's kit role", async () => {
    const spec = design();
    const away = { ...spec, colourways: [...spec.colourways, { id: "away-1", name: "Away", colours: [] }] } as unknown as GarmentSpec;
    const { deps } = doubles({ design: async () => ({ spec: away, charts: DEFAULT_CHART_SET, images: new Map(), version: 2 }) });
    const graph = canvas();
    const scene = sceneBySlug("flat-lay-white");
    const awayBoard = {
      ...(graph.boards[1] as BoardView),
      settings: settingsToStored({ sceneSlug: "flat-lay-white", crop: scene?.crops[0] ?? "1:1", kitRole: "away", colourwayId: null, roster: null, edge: 128 }),
    };

    const outcome = await renderMockupBoard(deps, { ...graph, boards: [graph.boards[0] as BoardView, awayBoard] }, "mockup-1");

    // The picture is drawn: the point is that the role found a colourway of the design by its own
    // name rather than inventing one, which `colourwayForRole` is the one place that decides.
    expect(outcome.ok).toBe(true);
  });
});
