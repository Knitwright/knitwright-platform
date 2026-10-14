import sharp from "sharp";
import type { VectorDoc, VectorNode } from "./model";
import { refuse, REFUSALS } from "./refuse";

/** Pictures inside a vector file are read like any upload: pixel cap first, then pixels only, as PNG. */
const MAX_EMBEDDED_PIXELS = 25_000_000;
const MAX_EMBEDDED_BASE64 = 11 * 1024 * 1024;
const EMBEDDED_EDGE = 2048;
const MAX_STORED_BASE64 = 4 * 1024 * 1024;

type Picture = Readonly<{ png: string; width: number; height: number }>;

async function reencode(base64: string): Promise<Picture> {
  if (base64.length > MAX_EMBEDDED_BASE64) return refuse(REFUSALS.tooBig(MAX_EMBEDDED_BASE64 / 1024));
  const bytes = Buffer.from(base64, "base64");
  try {
    const header = await sharp(bytes, { limitInputPixels: false }).metadata();
    const [width, height] = [header.width ?? 0, header.height ?? 0];
    if (header.format !== "png" && header.format !== "jpeg") return refuse(REFUSALS.external);
    if (width < 1 || height < 1 || width * height > MAX_EMBEDDED_PIXELS) return refuse(REFUSALS.tooComplex);
    let edge = EMBEDDED_EDGE;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const out = await sharp(bytes, { limitInputPixels: MAX_EMBEDDED_PIXELS, failOn: "error" })
        .rotate()
        .toColourspace("srgb")
        .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      const png = out.toString("base64");
      if (png.length <= MAX_STORED_BASE64) return { png, width, height };
      edge = Math.floor(edge * 0.7);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
  }
  return refuse("A picture inside this file could not be read.");
}

/** The picture fitted inside the box it was given, centred, keeping its shape. A box of no size means the picture's own size. */
function fit(box: Readonly<{ x: number; y: number; width: number; height: number }>, picture: Picture) {
  if (box.width <= 0.001 || box.height <= 0.001) {
    return { x: box.x, y: box.y, width: box.width > 0.001 ? box.width : picture.width, height: box.height > 0.001 ? box.height : picture.height };
  }
  const scale = Math.min(box.width / picture.width, box.height / picture.height);
  const [width, height] = [picture.width * scale, picture.height * scale];
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

async function mapNodes(nodes: readonly VectorNode[]): Promise<VectorNode[]> {
  const out: VectorNode[] = [];
  for (const node of nodes) {
    if (node.t === "g") out.push({ ...node, children: await mapNodes(node.children) });
    else if (node.t === "image") {
      const picture = await reencode(node.png);
      out.push({ ...node, ...fit(node, picture), png: picture.png });
    } else out.push(node);
  }
  return out;
}

/** Replaces each embedded picture with a re-encoded copy. Pictures inside clip paths are not drawn, so they are dropped. */
export async function reencodeImages(doc: VectorDoc): Promise<VectorDoc> {
  return {
    ...doc,
    nodes: await mapNodes(doc.nodes),
    clips: doc.clips.map((clip) => ({ ...clip, nodes: clip.nodes.filter((node) => node.t !== "image") })),
  };
}
