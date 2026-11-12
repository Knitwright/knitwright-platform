import { type AssetFile, type DrawnAsset, type Graph, type Size } from "@/lib/launch";
import { fillLayout, type SlotFill } from "@/lib/marketing/assets";
import { marketingSettings } from "@/lib/marketing/board";
import { place } from "@/lib/marketing/layout";
import { buildLayouts } from "@/lib/marketing/templates/plans";
import type { MarketingFormat, MarketingLayout, MarketingSlot } from "@/lib/marketing/templates/types";
import { renderBytes } from "@/lib/marketing/export/render";
import { layoutSvg } from "@/lib/marketing/export/svg";
import type { FlowCapability, FlowInputRef, FlowOutcome, FlowRunRequest } from "../run";
import { FLOW_GAP_RULE } from "../types";

/**
 * THE MARKETING BOARD, DRAWN FOR REAL IN A FLOW (decision 0133).
 *
 * L4 built one drawing (`export/svg.ts`) that every export is made from, and the bytes (`render.ts`).
 * This puts a board through them: its layout, its words, its colours and the pictures the platform
 * drew that feed it, as a PNG at the board's own size. Nothing here is a model and nothing costs.
 *
 * **The garment lock, said again where a picture enters a layout.** Only an input the platform drew
 * goes into a slot: `fillLayout` is asked, and refuses a generated provenance, and an input a model
 * made is never even offered. So a post fed by a render and an AI scene places the render and leaves
 * the scene out -- the scene stays a picture of its own, never part of the post's pixels.
 *
 * **A pack's post names no layout.** The six packs were written with a campaign and an aspect, not a
 * layout key, so a board without one is drawn on the first layout of its format that has a picture
 * slot, and the board's `headline` goes in the layout's headline. A board the Marketing panel has set
 * up is drawn exactly as it says.
 *
 * No watermark is drawn on a board's own output: it is the working picture another board may take.
 * The watermark is the export's (`ExportPanel`, `render.ts`), where the plan's rule is read.
 */

export interface MarketingPorts {
  /** The bytes of a file this brand holds, or null when it cannot be read. */
  readonly read: (fileId: string) => Promise<Uint8Array | null>;
  /** Stores a PNG the platform drew, as a deterministic render. */
  readonly store: (png: Uint8Array) => Promise<AssetFile>;
}

/** A board's aspect, as the marketing format it means. */
const FORMAT_OF_ASPECT: Readonly<Record<string, MarketingFormat>> = {
  "1:1": "social-square-1-1",
  "4:5": "social-post-4-5",
  "9:16": "story-9-16",
  "16:9": "hero-banner-16-9",
};

export const NO_LAYOUT_LINE = "This post has no layout, and none of the starter layouts is made for its shape. Pick one in the Marketing panel.";

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

function formatOf(settings: Readonly<Record<string, unknown>>, size: Size): MarketingFormat {
  const preset = text(settings["preset"]);
  if (preset === "a4-print") return "a4-print";
  const aspect = text(settings["aspect"]);
  if (aspect !== null && FORMAT_OF_ASPECT[aspect]) return FORMAT_OF_ASPECT[aspect];
  if (size.width === size.height) return "social-square-1-1";
  return size.width > size.height ? "hero-banner-16-9" : "social-post-4-5";
}

/** The layout a board is drawn on: its own, or the first of its format with a picture slot. */
export function layoutOfBoard(settings: Readonly<Record<string, unknown>>, size: Size, layouts: readonly MarketingLayout[] = buildLayouts()): MarketingLayout | null {
  const own = marketingSettings(settings).layoutKey;
  if (own !== null) return layouts.find((one) => one.key === own) ?? null;
  const format = formatOf(settings, size);
  return layouts.find((one) => one.formats.includes(format) && one.slots.some((slot) => slot.kind === "mockup")) ?? null;
}

/**
 * The longest edge a board's working picture is drawn at. A print-size file is the export panel's
 * (`render.ts`, at the target's own dots per inch); a board's own picture is what the canvas shows
 * and what the next board takes. Knitwright's own figure, not a spec one.
 */
export const MAX_DRAW_PX = 4096;

/** The size the PNG is drawn at: the board's own, never past `MAX_DRAW_PX`. */
const drawSize = (size: Size): Size => {
  const scale = Math.min(1, MAX_DRAW_PX / Math.max(size.width, size.height, 1));
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
};

const dataUri = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

/** The words a board holds: its own per slot, and a pack's `headline` in the layout's headline. */
function wordsOf(settings: Readonly<Record<string, unknown>>, slots: readonly MarketingSlot[]): Map<string, SlotFill> {
  const own = marketingSettings(settings).words;
  const words = new Map<string, SlotFill>();
  const headline = text(settings["headline"]);
  const top = slots.find((slot) => slot.style === "headline");
  if (headline !== null && top) words.set(top.id, { kind: "words", text: headline.slice(0, top.limit ?? headline.length) });
  for (const slot of slots) {
    const said = own[slot.id];
    if (said !== undefined && (slot.kind === "text" || slot.kind === "qr")) words.set(slot.id, { kind: "words", text: said });
  }
  return words;
}

/** The drawn inputs, in input order, as pictures for the layout's picture slots. Never a generated one. */
async function picturesOf(ports: MarketingPorts, slots: readonly MarketingSlot[], inputs: readonly FlowInputRef[]) {
  const offered = new Map<string, SlotFill>();
  const pictures = new Map<string, string>();
  const drawn = [...inputs].filter((input) => !input.generated && input.fileId !== null).sort((a, b) => a.inputIndex - b.inputIndex);
  const mockupSlots = slots.filter((slot) => slot.kind === "mockup");
  for (const [at, slot] of mockupSlots.entries()) {
    const input = drawn[at];
    if (!input?.fileId) break;
    const bytes = await ports.read(input.fileId);
    if (bytes === null) continue;
    const asset: DrawnAsset = { role: "scene", provenance: "deterministic", file: { fileId: input.fileId, contentType: "image/png" } };
    offered.set(slot.id, { kind: "picture", asset });
    pictures.set(slot.id, dataUri(bytes));
  }
  return { offered, pictures };
}

export function marketingCapability(graph: Graph, ports: MarketingPorts): FlowCapability {
  return {
    run: async (request: FlowRunRequest): Promise<FlowOutcome> => {
      const board = graph.boards.find((one) => one.id === request.boardId);
      if (!board) return { ok: false, reason: "That board is no longer on the canvas.", ruleId: FLOW_GAP_RULE };
      const layout = layoutOfBoard(request.settings, board.size);
      if (layout === null) return { ok: false, reason: NO_LAYOUT_LINE, ruleId: FLOW_GAP_RULE };

      const size = drawSize(board.size);
      const words = wordsOf(request.settings, layout.slots);
      const { offered, pictures } = await picturesOf(ports, layout.slots, request.inputs);
      const filled = fillLayout(layout.slots, new Map([...words, ...offered]));
      const drawing = layoutSvg({
        size,
        slots: place(layout.slots, size),
        fills: filled.fills,
        // Only the pictures `fillLayout` accepted are drawn: a refused fill is an empty frame.
        pictures: new Map([...pictures].filter(([slotId]) => filled.fills.has(slotId))),
        colours: marketingSettings(request.settings).colours,
        withBackground: true,
        watermark: null,
      });
      const png = await renderBytes({ drawing, size, format: "png", colourSpace: "rgb", watermark: false, profile: null, withBackground: true });
      const file = await ports.store(png);
      return { ok: true, asset: { role: "scene", provenance: "deterministic", file } };
    },
  };
}
