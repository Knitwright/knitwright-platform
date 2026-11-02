import { describe, expect, it } from "vitest";
import type { Graph } from "@/lib/launch";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { listingPayload, listingVerdict, LISTING_KIND, trueColourSource } from "./listing";
import { runFlow } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";

/**
 * "Publish to store" (spec F-L4), which publishes nothing: it writes a payload for wave 5's Store
 * contract (O2) to collect. Owner decision 1 keeps the Store out of this platform, so the test that
 * matters most here is the one that reads every field name and finds nothing about money.
 */

const ran = async (slug = "club-kit-launch-pack"): Promise<Graph> => {
  const { graph } = canvasOfTemplate(slug);
  const report = await runFlow(
    { capability: stubCapability(), meter: stubMeter({ balance: 100 }), recorder: stubRecorder() },
    graph,
    { from: null, scope: "all" },
    STUB_COSTS,
  );
  return report.lines.reduce((left, line) => (line.fileId === null ? left : withBoard(left, line.boardId, { status: "ready", outputFileId: line.fileId })), graph);
};

const input = {
  launchProjectId: "44444444-4444-4444-8444-444444444444",
  title: "Home kit 2027",
  designProjectId: "11111111-1111-4111-8111-111111111111",
  designVersion: 7,
};

const keysOf = (value: unknown, found: Set<string> = new Set()): ReadonlySet<string> => {
  if (Array.isArray(value)) for (const one of value) keysOf(one, found);
  else if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      found.add(key);
      keysOf(inner, found);
    }
  }
  return found;
};

describe("the listing payload", () => {
  it("names every finished picture and clip of the run, and nothing that did not finish", async () => {
    const payload = listingPayload(await ran(), input);

    expect(payload.kind).toBe(LISTING_KIND);
    expect(payload.payloadVersion).toBe(1);
    expect(payload.media).toHaveLength(14);
    expect(payload.media.filter((one) => one.role === "video")).toHaveLength(1);
    expect(payload.media.every((one) => one.fileId.length > 0)).toBe(true);
  });

  it("says plainly that nothing has been published", async () => {
    const payload = listingPayload(await ran(), input);

    expect(payload.note).toContain("A hand-off, not a publication");
    expect(payload.note).toContain("Nothing has been published, priced or put on sale");
  });

  it("has no field about money, stock, a cart or a storefront anywhere in it", async () => {
    const keys = [...keysOf(listingPayload(await ran(), input))].map((key) => key.toLowerCase());

    for (const forbidden of ["price", "pricing", "cost", "currency", "cart", "checkout", "stripe", "payment", "payout", "stock", "inventory", "storefront", "shipping"]) {
      expect(keys.filter((key) => key.includes(forbidden)), forbidden).toEqual([]);
    }
  });

  it("labels every picture a model touched and names the true-colour picture to show beside it", async () => {
    const graph = await ran();
    const payload = listingPayload(graph, input);
    const scene = payload.media.find((one) => one.boardId === "line-up");
    const render = payload.media.find((one) => one.boardId === "render-front");

    expect(scene?.label).toBe("AI-generated");
    expect(render?.label).toBeNull();
    expect(render?.trueColourFileId).toBeNull();
    // This scene is fed straight from the Design board, which holds the live render and no file, so
    // there is no file to name and the payload says null rather than naming the scene itself.
    expect(scene?.trueColourFileId).toBeNull();

    const drop = listingPayload(await ran("brand-drop-pack"), input);
    expect(drop.media.find((one) => one.boardId === "lifestyle-city")?.trueColourFileId).not.toBeNull();
  });

  /**
   * H1 of the v5 security review (decision 0116). The label was worked out from the shape of the
   * canvas alone, and the whole of what that attack bought was a generated picture sitting on a
   * board the platform draws, whose topology says nothing a model made could have reached it -- so
   * the mandatory label came out `null`. The files' own rows answer as well now, and either answer
   * is enough: pass the render's own file as one a model made and it is labelled.
   */
  it("labels a picture its own file says a model made, whatever the shape of the canvas says", async () => {
    const graph = await ran();
    const render = graph.boards.find((one) => one.id === "render-front");
    const fileId = render?.outputFileId as string;

    expect(listingPayload(graph, input).media.find((one) => one.boardId === "render-front")?.label).toBeNull();
    expect(listingPayload(graph, { ...input, generatedFileIds: [fileId] }).media.find((one) => one.boardId === "render-front")?.label).toBe(
      "AI-generated",
    );
  });

  it("still labels a picture the canvas says a model touched when the files say nothing", async () => {
    const graph = await ran();
    const payload = listingPayload(graph, { ...input, generatedFileIds: [] });
    expect(payload.media.find((one) => one.boardId === "line-up")?.label).toBe("AI-generated");
  });

  it("finds the nearest picture the platform drew, walking back up the connectors", async () => {
    const graph = await ran("brand-drop-pack");

    expect(trueColourSource(graph, "clip-orbit")).toBe(graph.boards.find((one) => one.id === "white-1-1-front")?.outputFileId);
    expect(trueColourSource(graph, "white-1-1-front")).toBeNull();
  });

  it("takes only the boards it is asked for", async () => {
    const payload = listingPayload(await ran(), { ...input, boardIds: ["render-front", "render-back"] });

    expect(payload.media.map((one) => one.boardId).sort()).toEqual(["render-back", "render-front"]);
  });
});

describe("whether there is anything to hand over", () => {
  it("is ready once a run has made at least one picture", async () => {
    expect(listingVerdict(listingPayload(await ran(), input))).toEqual({ ready: true });
  });

  it("says to run the flow first when nothing has been made", () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const verdict = listingVerdict(listingPayload(graph, input));

    expect(verdict.ready).toBe(false);
    expect(verdict.ready ? "" : verdict.reason).toContain("Run the flow first");
  });

  it("says to pick a design when the pack has none", async () => {
    const verdict = listingVerdict(listingPayload(await ran(), { ...input, designProjectId: null }));

    expect(verdict.ready ? "" : verdict.reason).toContain("a listing is a listing of a design");
  });

  it("refuses a listing of nothing but a clip", async () => {
    const graph = await ran();
    const onlyClip = listingPayload(graph, { ...input, boardIds: ["turntable"] });

    expect(onlyClip.media).toHaveLength(1);
    expect(listingVerdict(onlyClip).ready ? "" : (listingVerdict(onlyClip) as { reason: string }).reason).toContain("not only a clip");
  });
});
