import type { Layer, StackColour, ViewId } from "@/lib/artwork-stack";
import type { LandmarkId } from "@/lib/production/contract";
import { roundMm } from "@/lib/artwork-stack";
import { deltaE, rgbToLab, toStackColours, type Cluster, MERGE_DELTA_E, type Rgb } from "./colours";
import { toDesign, type ViewFit } from "./fit";
import type { Rect } from "./outline";
import type { ReadMark } from "./read";
import { CROP_FLAG, emptyViewSentence, type ReportItem } from "./report";
import { toHex, type Raster } from "./raster";
import type { LandmarkTemplate } from "./template";
import { clamp01, round2 } from "./types";

/**
 * Step 5: marks. Text and numbers become `text` or `player-mark` layers; crests, sponsors and badges are cropped
 * as `graphic` layers flagged "redrawn from a picture, replace with your own file". The ground under a mark is
 * repaired from its neighbours so the colours and any pattern are read from the cloth, not from the print.
 */

export interface Crop {
  readonly assetId: string;
  readonly view: ViewId;
  readonly rect: Rect;
}

export interface MarksResult {
  readonly layers: readonly Layer[];
  readonly items: readonly ReportItem[];
  readonly colours: readonly StackColour[];
  readonly rects: readonly Rect[];
  readonly crops: readonly Crop[];
}

export interface MarksInput {
  readonly marks: readonly ReadMark[];
  readonly readingConfidence: number;
  readonly raster: Raster;
  readonly fits: ReadonlyMap<ViewId, ViewFit>;
  readonly template: LandmarkTemplate;
  readonly colours: readonly StackColour[];
}

const common = { opacity: 1, blend: "normal" as const, provenance: "read-from-image" as const };

export const markRect = (mark: ReadMark, raster: Raster): Rect => ({
  x0: Math.floor(mark.box.x * raster.width),
  y0: Math.floor(mark.box.y * raster.height),
  x1: Math.min(raster.width, Math.ceil((mark.box.x + mark.box.w) * raster.width)),
  y1: Math.min(raster.height, Math.ceil((mark.box.y + mark.box.h) * raster.height)),
});

/** A copy with each rectangle filled with the middle colour of the ring of pixels around it. */
export function repairGround(raster: Raster, rects: readonly Rect[]): Raster {
  const data = new Uint8ClampedArray(raster.data);
  for (const r of rects) {
    const ring: Rgb[] = [];
    for (let y = Math.max(0, r.y0 - 3); y < Math.min(raster.height, r.y1 + 3); y += 1) {
      for (let x = Math.max(0, r.x0 - 3); x < Math.min(raster.width, r.x1 + 3); x += 1) {
        if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) continue;
        const at = (y * raster.width + x) * 4;
        ring.push([raster.data[at], raster.data[at + 1], raster.data[at + 2]]);
      }
    }
    if (ring.length === 0) continue;
    const mid = (c: 0 | 1 | 2): number => ring.map((p) => p[c]).sort((a, b) => a - b)[Math.floor(ring.length / 2)];
    for (let y = Math.max(0, r.y0); y < Math.min(raster.height, r.y1); y += 1) {
      for (let x = Math.max(0, r.x0); x < Math.min(raster.width, r.x1); x += 1) data.set([mid(0), mid(1), mid(2), 255], (y * raster.width + x) * 4);
    }
  }
  return { width: raster.width, height: raster.height, data };
}

/** The colour that is most common in a box and unlike the ground, or null. */
function inkOf(raster: Raster, rect: Rect, ground: StackColour | undefined): Rgb | null {
  const bins = new Map<string, { n: number; sum: [number, number, number] }>();
  const groundLab = ground?.screen ? rgbToLab(hexToRgb(ground.screen)) : null;
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const at = (y * raster.width + x) * 4;
      const rgb: Rgb = [raster.data[at], raster.data[at + 1], raster.data[at + 2]];
      if (groundLab && deltaE(rgbToLab(rgb), groundLab) < 20) continue;
      const key = rgb.map((v) => v >> 5).join(",");
      const bin = bins.get(key) ?? { n: 0, sum: [0, 0, 0] };
      bins.set(key, { n: bin.n + 1, sum: [bin.sum[0] + rgb[0], bin.sum[1] + rgb[1], bin.sum[2] + rgb[2]] });
    }
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  return top ? [top.sum[0] / top.n, top.sum[1] / top.n, top.sum[2] / top.n] : null;
}

const hexToRgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** The colour id for an ink: an existing colour if one is near, else a new one (at most 3 inks are added). */
function colourFor(rgb: Rgb | null, colours: readonly StackColour[], added: number): { id: string | undefined; colours: readonly StackColour[] } {
  if (rgb === null) return { id: undefined, colours };
  const lab = rgbToLab(rgb);
  const near = colours.find((c) => c.screen !== undefined && deltaE(lab, rgbToLab(hexToRgb(c.screen))) < MERGE_DELTA_E);
  if (near) return { id: near.id, colours };
  if (added >= 3) return { id: undefined, colours };
  const cluster: Cluster = { lab, rgb, hex: toHex(rgb), share: 0 };
  const [fresh] = toStackColours([cluster], colours.length);
  return { id: fresh.id, colours: [...colours, fresh] };
}

function anchorFor(fit: ViewFit, template: LandmarkTemplate, centre: { x: number; y: number }): { anchorId: LandmarkId; offset: { x: number; y: number } } | null {
  const wanted = template.landmarks(fit.view);
  const here = toDesign(fit, centre);
  const ids = (Object.keys(wanted) as LandmarkId[]).filter((id) => fit.used.includes(id));
  const nearest = ids.reduce<LandmarkId | null>((best, id) => {
    const d = (p: { x: number; y: number }): number => Math.hypot(p.x - here.x, p.y - here.y);
    const [a, b] = [wanted[id], best ? wanted[best] : undefined];
    return a && (!b || d(a) < d(b)) ? id : best;
  }, null);
  const at = nearest ? wanted[nearest] : undefined;
  return nearest && at ? { anchorId: nearest, offset: { x: roundMm(here.x - at.x), y: roundMm(here.y - at.y) } } : null;
}

const KIND_WORDS: Readonly<Record<ReadMark["kind"], string>> = {
  number: "Number",
  name: "Name",
  crest: "Crest",
  sponsor: "Sponsor",
  "sleeve-badge": "Sleeve badge",
};

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function readMarks(input: MarksInput): MarksResult {
  const { raster, fits, template } = input;
  let colours = input.colours;
  let inks = 0;
  const layers: Layer[] = [];
  const items: ReportItem[] = [];
  const rects: Rect[] = [];
  const crops: Crop[] = [];
  const ground = colours[0];
  const namesByView = new Map(input.marks.filter((m) => m.kind === "name" && m.text).map((m) => [m.view, m.text as string]));

  input.marks.forEach((mark, at) => {
    const id = `mark-${at + 1}`;
    const label = `${KIND_WORDS[mark.kind]}${mark.text ? ` "${clip(mark.text, 24)}"` : ""}`;
    const fit = fits.get(mark.view);
    const rect = markRect(mark, raster);
    if (!fit) {
      items.push({ id, label, confidence: 0, note: emptyViewSentence(mark.view, "not-fitted") });
      return;
    }
    rects.push(rect);
    const centre = { x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2 };
    const place = anchorFor(fit, template, centre);
    if (!place) {
      items.push({ id, label, confidence: 0, note: `No landmark near the ${mark.kind} could be used to place it, so it was not added.` });
      return;
    }
    const heightMm = roundMm(Math.max(1, (rect.y1 - rect.y0) * fit.mmPerPixel));
    const widthMm = roundMm(Math.max(1, (rect.x1 - rect.x0) * fit.mmPerPixel));
    const sure = round2(clamp01(input.readingConfidence * fit.confidence));
    const placement = { kind: "anchor" as const, anchorId: place.anchorId };
    const base = { ...common, id, views: [mark.view], name: clip(label, 60) };

    if (mark.kind === "crest" || mark.kind === "sponsor" || mark.kind === "sleeve-badge") {
      const assetId = `crop-${at + 1}`;
      crops.push({ assetId, view: mark.view, rect });
      layers.push({ ...base, kind: "graphic", source: { kind: "asset", assetId }, placement, offsetMm: place.offset, widthMm, heightMm, rotationDeg: 0, clearSpaceMm: 0, knockOut: false });
      items.push({ id, layerId: id, label, confidence: round2(Math.min(sure, 0.5)), note: `${CROP_FLAG}.` });
      return;
    }

    const ink = colourFor(inkOf(raster, rect, ground), colours, inks);
    if (ink.colours !== colours) inks += 1;
    colours = ink.colours;
    const side = mark.view === "back" ? "back" : mark.view === "front" ? "front" : null;
    if (mark.kind === "number" && side) {
      const name = namesByView.get(mark.view);
      const number = mark.text && /^\d{1,2}$/.test(mark.text) ? mark.text : undefined;
      layers.push({ ...base, kind: "player-mark", place: side === "back" ? "back-number" : "front-number", style: mark.lettering, heightMm, colourId: ink.id, ...(name && number ? { sample: { name, number } } : {}) });
    } else if (mark.kind === "name" && side === "back") {
      const number = input.marks.find((m) => m.kind === "number" && m.view === "back" && m.text && /^\d{1,2}$/.test(m.text))?.text;
      layers.push({ ...base, kind: "player-mark", place: "back-name", style: mark.lettering, heightMm, colourId: ink.id, ...(mark.text && number ? { sample: { name: mark.text, number } } : {}) });
    } else if (mark.text) {
      layers.push({ ...base, kind: "text", text: mark.text, lettering: mark.lettering, placement, offsetMm: place.offset, heightMm, widthMm, rotationDeg: 0, colourId: ink.id });
    } else {
      items.push({ id, label, confidence: 0, note: "The words could not be read, so nothing was added. Type them in yourself." });
      return;
    }
    const readable = mark.text ? 1 : 0.6;
    items.push({ id, layerId: id, label, confidence: round2(sure * readable), note: "Lettering style is the nearest of ours. Check the words and size." });
  });
  return { layers, items, colours, rects, crops };
}
