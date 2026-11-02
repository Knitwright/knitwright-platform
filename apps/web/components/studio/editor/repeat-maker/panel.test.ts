import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { UploadedArtwork } from "@/lib/artwork-intake/client";
import { draft as repeatDraft, layer } from "@/lib/repeat/fixtures/drafts";
import { publishRepeat, PUBLISH_DPI, type DrawingSurface, type PublishDeps } from "./publish";
import { layerFromShape, layerFromUpload, repeatView, startDraft, typeSide, withUnit } from "./state";
import { drawTile, publishedFileName, scaleForDpi, tilePixels, type TileContext } from "./tile-canvas";
import { TilePreview } from "./TilePreview";

/** The repeat maker (spec F-S4). The rules are in lib/repeat; this is what the panel does with them. */

/** A context that writes down every call, in order, so what is drawn is a fact and not a guess. */
const recordingContext = () => {
  const calls: string[] = [];
  const context: TileContext = {
    fillStyle: "",
    fillRect: (...args) => calls.push(`fillRect(${args.join(",")}) in ${context.fillStyle}`),
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: (x, y) => calls.push(`translate(${x},${y})`),
    rotate: (radians) => calls.push(`rotate(${radians.toFixed(4)})`),
    beginPath: () => calls.push("beginPath"),
    ellipse: (...args) => calls.push(`ellipse(${args.slice(0, 4).join(",")})`),
    fill: () => calls.push(`fill in ${context.fillStyle}`),
    drawImage: (_image, ...args) => calls.push(`drawImage(${args.join(",")})`),
  };
  return { context, calls };
};

describe("what the panel shows", () => {
  it("names a new repeat after the base article it was started from", () => {
    expect(startDraft("JSY-SS-01 Sublimated jersey").name).toBe("JSY-SS-01 Sublimated jersey fill");
  });

  it("says what repeats once and lays the preview across several tiles", () => {
    const view = repeatView(repeatDraft());
    expect(view.periodSentence).toBe("Repeats every 10 cm across and 10 cm down.");
    expect(view.preview.tiles.length).toBeGreaterThan(4);
    expect(view.blocked).toBe(false);
    expect(view.rangeSentence).toContain("not reviewed by a print house");
  });

  it("reads a tile side that is typed, and refuses one outside the range with its reason", () => {
    const read = typeSide(repeatDraft(), "width", "20");
    expect(read.ok).toBe(true);
    expect(read.ok && read.draft.tile.widthTenths).toBe(2000);
    const refused = typeSide(repeatDraft(), "width", "500");
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.reason).toContain("1 to 200 cm");
  });

  it("keeps a layer inside the tile when the tile shrinks, and leaves one that was already over the edge", () => {
    const smaller = typeSide(repeatDraft(), "width", "4");
    expect(smaller.ok && smaller.draft.layers[0]?.xTenths).toBe(200);
    const already = typeSide(repeatDraft({ layers: [layer({ xTenths: 0 })] }), "width", "4");
    expect(already.ok && already.draft.layers[0]?.xTenths).toBe(0);
  });

  it("changes the unit a person types in without resizing the tile", () => {
    const inches = withUnit(repeatDraft(), "in");
    expect(inches.tile).toEqual(repeatDraft().tile);
    expect(repeatView(inches).widthText).toBe("3.94");
  });

  it("makes a layer from an upload, keeping its pixels so the resolution check has something to read", () => {
    const artwork = { id: "aa", label: "Club crest", widthPx: 1200, heightPx: 800 } as UploadedArtwork;
    const made = layerFromUpload(repeatDraft(), artwork);
    expect(made).toMatchObject({ id: "aa", label: "Club crest", artworkId: "aa", shape: null, sourcePx: { width: 1200, height: 800 } });
  });

  it("makes a drawn layer with an id of its own, so two of a kind can both be on the tile", () => {
    expect(layerFromShape(repeatDraft(), "stripe", "#00ff00", 2)).toMatchObject({ id: "stripe-2", label: "Stripe 2", shape: "stripe", artworkId: null, colour: "#00ff00" });
  });
});

describe("the preview", () => {
  it("draws every tile the layout asks for and the tile's own bounds", () => {
    const view = repeatView(repeatDraft());
    const html = renderToStaticMarkup(createElement(TilePreview, { view: view.preview, crossing: view.crossing }));
    expect(html).toContain(`data-tiles="${view.preview.tiles.length}"`);
    expect(html).toContain('data-testid="repeat-tile-bounds"');
  });

  it("flips the right tiles for a mirror repeat", () => {
    const view = repeatView(repeatDraft({ style: "mirror" }));
    const html = renderToStaticMarkup(createElement(TilePreview, { view: view.preview, crossing: view.crossing }));
    expect(html).toContain("scale(-1 1)");
    expect(html).toContain("scale(-1 -1)");
  });

  it("marks the bounds differently when something crosses them", () => {
    const over = repeatView(repeatDraft({ wrap: false, layers: [layer({ xTenths: 0 })] }));
    const html = renderToStaticMarkup(createElement(TilePreview, { view: over.preview, crossing: over.crossing }));
    expect(html).toContain("#f0b429");
  });
});

describe("drawing the tile", () => {
  it("fills the background first, then the layers from the bottom up", () => {
    const { context, calls } = recordingContext();
    drawTile(context, repeatDraft({ background: "#eeeeee", layers: [layer({ id: "a", artworkId: null, shape: "square" }), layer({ id: "b", artworkId: null, shape: "circle" })] }), 1);
    expect(calls[0]).toBe("fillRect(0,0,1000,1000) in #eeeeee");
    expect(calls.filter((call) => call.startsWith("ellipse"))).toHaveLength(1);
    expect(calls.indexOf("beginPath")).toBeGreaterThan(calls.findIndex((call) => call.includes("fillRect(-250")));
  });

  it("draws a picture where its file has loaded, and its own box where it has not", () => {
    const loaded = recordingContext();
    drawTile(loaded.context, repeatDraft(), 1, new Map([[layer().artworkId as string, { tag: "picture" }]]));
    expect(loaded.calls.some((call) => call.startsWith("drawImage(-250,-250,500,500)"))).toBe(true);
    const missing = recordingContext();
    drawTile(missing.context, repeatDraft(), 1);
    expect(missing.calls.some((call) => call.startsWith("drawImage"))).toBe(false);
    expect(missing.calls.some((call) => call.includes("fillRect(-250,-250,500,500)"))).toBe(true);
  });

  it("draws a stripe as a band across its own width, not a full square", () => {
    const { context, calls } = recordingContext();
    drawTile(context, repeatDraft({ layers: [layer({ artworkId: null, shape: "stripe" })] }), 1);
    expect(calls.some((call) => call.includes("fillRect(-250,-100,500,200)"))).toBe(true);
  });

  it("turns a layer only where it is turned, and always puts the context back", () => {
    const { context, calls } = recordingContext();
    drawTile(context, repeatDraft({ layers: [layer({ artworkId: null, shape: "square", rotationDeg: 45 })] }), 1);
    expect(calls.some((call) => call.startsWith("rotate("))).toBe(true);
    expect(calls.filter((call) => call === "save")).toHaveLength(calls.filter((call) => call === "restore").length);
    const upright = recordingContext();
    drawTile(upright.context, repeatDraft({ layers: [layer({ artworkId: null, shape: "square" })] }), 1);
    expect(upright.calls.some((call) => call.startsWith("rotate("))).toBe(false);
  });

  it("draws the copies that join the tile at its edges", () => {
    const { calls } = recordingContext();
    const wrapped = recordingContext();
    drawTile(wrapped.context, repeatDraft({ layers: [layer({ xTenths: 0, yTenths: 0, artworkId: null, shape: "square" })] }), 1);
    expect(wrapped.calls.filter((call) => call === "save")).toHaveLength(4);
    expect(calls).toHaveLength(0);
  });

  it("sizes the published canvas from the resolution, and never to nothing", () => {
    expect(scaleForDpi(254)).toBe(1);
    expect(tilePixels(repeatDraft(), PUBLISH_DPI)).toEqual({ width: 1181, height: 1181 });
    expect(tilePixels(repeatDraft({ tile: { widthTenths: 100, heightTenths: 100 } }), 1)).toEqual({ width: 1, height: 1 });
  });

  it("names the published file after the repeat, its style and its tile size", () => {
    expect(publishedFileName(repeatDraft({ name: "Club hoops", style: "half-drop" }))).toBe("Club hoops - Half-drop 10x10cm.png");
    expect(publishedFileName(repeatDraft({ name: "  ../../etc/passwd  " }))).toBe("etcpasswd - Full drop 10x10cm.png");
    expect(publishedFileName(repeatDraft({ name: "!!!" }))).toBe("Pattern fill - Full drop 10x10cm.png");
  });
});

describe("publishing to Your library", () => {
  const surface = (png: Blob | null = new Blob(["png"], { type: "image/png" })): DrawingSurface => {
    const { context } = recordingContext();
    return { width: 10, height: 10, context: () => context, png: async () => png };
  };

  const deps = (over: Partial<PublishDeps> = {}): PublishDeps => ({
    images: new Map(),
    surface: () => surface(),
    send: vi.fn(async (file: File) => ({ ok: true as const, data: { id: "a1", label: file.name } as UploadedArtwork })),
    ...over,
  });

  it("sends the tile as a PNG through the artwork upload, which screens it before it is stored", async () => {
    const send = vi.fn(async (file: File) => ({ ok: true as const, data: { id: "a1", label: file.name } as UploadedArtwork }));
    const outcome = await publishRepeat(deps({ send }), repeatDraft({ name: "Club hoops" }));
    expect(outcome.ok).toBe(true);
    const sent = send.mock.calls[0]?.[0] as File;
    expect(sent.type).toBe("image/png");
    expect(sent.name).toBe("Club hoops - Full drop 10x10cm.png");
  });

  it("draws nothing and sends nothing for a repeat a blocker stops", async () => {
    const send = vi.fn();
    const outcome = await publishRepeat(deps({ send: send as unknown as PublishDeps["send"] }), repeatDraft({ layers: [] }));
    expect(outcome.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(outcome.findings.map((entry) => entry.code)).toContain("repeat-no-layers");
  });

  it("publishes a repeat with a warning and hands the warning back, so the person is still told", async () => {
    const outcome = await publishRepeat(deps(), repeatDraft({ wrap: false, layers: [layer({ xTenths: 0 })] }));
    expect(outcome.ok).toBe(true);
    expect(outcome.findings.map((entry) => entry.code)).toEqual(["repeat-layer-outside-tile"]);
  });

  it("says plainly when the browser could not draw the tile", async () => {
    const noContext = await publishRepeat(deps({ surface: () => ({ width: 1, height: 1, context: () => null, png: async () => null }) }), repeatDraft());
    expect(noContext).toMatchObject({ ok: false });
    expect(noContext.ok === false && noContext.reason).toContain("could not draw the tile");
    const noPng = await publishRepeat(deps({ surface: () => surface(null) }), repeatDraft());
    expect(noPng.ok).toBe(false);
  });

  it("passes the upload's own refusal through, so a blocked picture is reported as such", async () => {
    const outcome = await publishRepeat(deps({ send: async () => ({ ok: false, reason: "That picture is of a registered mark." }) }), repeatDraft());
    expect(outcome).toMatchObject({ ok: false, reason: "That picture is of a registered mark." });
  });
});
