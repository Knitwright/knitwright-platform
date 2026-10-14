import { patternPieceSchema, LANDMARK_IDS, SEAM_ALLOWANCE_SOURCES, OUTLINE_KINDS, type LandmarkId, type PatternPiece, type Point } from "@/lib/production/contract";
import { dist, round2 } from "../geometry";
import { detectLandmarks } from "../landmarks";
import { seamsOf } from "../seams";
import { parseDxf, type DxfBlock, type DxfDocument, type DxfEntity } from "./parse";

/**
 * Reads an AAMA/ASTM-style pattern DXF into pieces: a block per piece and size, the cut line
 * on layer 1, turn points on 2, notches on 4, the grain line on 7 (or 5), the fold line on 6,
 * internal lines on 8 and the sew line on 14, with the piece's name, size and quantity as text.
 * Layer 3 holds curve points that repeat the outline and is not needed. Anything on another
 * layer is left out and reported, never dropped without a word.
 */

export type DxfFileInfo = Readonly<{ styleName: string | null; sampleSize: string | null }>;

export type ReadDxfResult = Readonly<{
  pieces: readonly PatternPiece[];
  warnings: readonly string[];
  info: DxfFileInfo;
}>;

const KNOWN_LAYERS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "14"]);
const UNIT_FACTORS: Readonly<Record<string, number>> = { "1": 25.4, "4": 1, "5": 10, "6": 1000 };
const SAME_NOTCH_MM = 2;
const TENTH_MM = 0.005;

const num = (entity: DxfEntity, code: number): number => Number(entity.pairs.find((p) => p[0] === code)?.[1]);
const text = (entity: DxfEntity): string => entity.pairs.find((p) => p[0] === 1)?.[1] ?? "";
const at = (entity: DxfEntity): Point => [num(entity, 10), num(entity, 20)];

/** "KEY: value" lines of a block's TEXT entities. A key given twice keeps its first value. */
function annotations(entities: readonly DxfEntity[]): { first: Map<string, string>; all: [string, string][] } {
  const all: [string, string][] = [];
  for (const entity of entities.filter((e) => e.type === "TEXT")) {
    const line = text(entity);
    const colon = line.indexOf(":");
    if (colon > 0) all.push([line.slice(0, colon).trim().toUpperCase(), line.slice(colon + 1).trim()]);
  }
  const first = new Map<string, string>();
  for (const [key, value] of all) if (!first.has(key)) first.set(key, value);
  return { first, all };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const FILLER_WORDS = new Set(["torso", "full", "right", "left", "piece"]);

/** "torso front" is the front, "sleeve full right" the sleeve: the words that only describe the cut are dropped. */
export function pieceIdFromName(name: string): string {
  const words = slug(name).split("-").filter(Boolean);
  const meaningful = words.filter((word) => !FILLER_WORDS.has(word));
  return (meaningful.length > 0 ? meaningful : words).join("-").slice(0, 64) || "piece";
}

function closedRun(vertices: readonly (readonly [number, number])[], factor: number): Point[] {
  const points = vertices.map(([x, y]): Point => [round2(x * factor), round2(y * factor)]);
  const [first, last] = [points[0], points.at(-1)];
  return first && last && points.length > 3 && dist(first, last) <= TENTH_MM * 2 ? points.slice(0, -1) : points;
}

function lineOf(entity: DxfEntity | undefined, factor: number): { from: Point; to: Point } | null {
  if (!entity) return null;
  const from: Point = [round2(num(entity, 10) * factor), round2(num(entity, 20) * factor)];
  const to: Point = [round2(num(entity, 11) * factor), round2(num(entity, 21) * factor)];
  return Number.isFinite(from[0] + from[1] + to[0] + to[1]) ? { from, to } : null;
}

function quantityOf(value: string | undefined, warn: (s: string) => void): { quantity: number; mirroredPair: boolean } {
  const [cut, mirrored] = (value ?? "1,0").split(",").map((part) => Number.parseInt(part.trim(), 10));
  const normal = Number.isFinite(cut) ? cut : 1;
  const other = Number.isFinite(mirrored) ? mirrored : 0;
  const quantity = Math.max(1, normal + other);
  if (other > 0 && quantity % 2 === 0) return { quantity, mirroredPair: true };
  if (other > 0) warn("A piece says it is cut mirrored but in an odd number; it was read as not mirrored.");
  return { quantity, mirroredPair: false };
}

function layered(block: DxfBlock, layer: string, type?: string): DxfEntity[] {
  return block.entities.filter((e) => e.layer === layer && (type === undefined || e.type === type));
}

function notchesOf(block: DxfBlock, factor: number): PatternPiece["notches"] {
  const labels = layered(block, "4", "TEXT")
    .map((e) => ({ at: at(e), words: text(e).split(/\s+/) }))
    .filter((l) => l.words[0]?.toUpperCase() === "NOTCH:");
  const found: { seamId: string; at: Point; count: number }[] = [];
  for (const entity of layered(block, "4", "POINT")) {
    const point: Point = [round2(num(entity, 10) * factor), round2(num(entity, 20) * factor)];
    const label = labels.find((l) => dist([l.at[0] * factor, l.at[1] * factor], point) <= 0.05);
    const near = found.find((n) => !label && n.seamId === "unassigned" && dist(n.at, point) <= SAME_NOTCH_MM);
    if (near) near.count += 1;
    else found.push({ seamId: label?.words[1] ?? "unassigned", at: point, count: Math.min(3, Math.max(1, Number(label?.words[2]) || 1)) });
  }
  return found;
}

function allowancesOf(all: readonly [string, string][]): PatternPiece["seamAllowance"] {
  return all
    .filter(([key]) => key === "SEAM ALLOWANCE")
    .flatMap(([, value]) => {
      const [seamId, mm, source] = value.split(/\s+/);
      const stated = mm !== "not-stated" ? Number(mm) : null;
      const kind = (SEAM_ALLOWANCE_SOURCES as readonly string[]).includes(source ?? "") ? (source as PatternPiece["seamAllowance"][number]["source"]) : "pattern-file";
      if (!seamId || (stated !== null && !Number.isFinite(stated))) return [];
      return [{ seamId, mm: stated === null ? null : stated, source: stated === null ? ("not-stated" as const) : kind }];
    });
}

function namedLandmarks(all: readonly [string, string][], factor: number): Partial<Record<LandmarkId, Point>> {
  const known = new Set<string>(LANDMARK_IDS);
  return Object.fromEntries(
    all
      .filter(([key]) => key === "LANDMARK")
      .map(([, value]) => value.split(/\s+/))
      .filter(([name, x, y]) => known.has(name) && Number.isFinite(Number(x)) && Number.isFinite(Number(y)))
      .map(([name, x, y]) => [name, [round2(Number(x) * factor), round2(Number(y) * factor)] as Point]),
  );
}

type Context = Readonly<{ factor: number; fileSize: string | null; warn: (s: string) => void }>;

function pieceFromBlock(block: DxfBlock, context: Context): PatternPiece | null {
  const { factor, warn } = context;
  const { first, all } = annotations(block.entities);
  const label = first.get("PIECE NAME") ?? block.name.replace(/_[^_]+$/, "");
  const suffix = /_([^_]+)$/.exec(block.name)?.[1] ?? null;
  const sizeLabel = first.get("SIZE") ?? suffix ?? context.fileSize;
  const outline = layered(block, "1", "POLYLINE")[0];
  if (!outline || outline.vertices.length < 3) {
    warn(`"${label}" has no cut line on layer 1, so it was left out.`);
    return null;
  }
  if (!sizeLabel) {
    warn(`"${label}" does not say which size it is, so it was left out.`);
    return null;
  }
  const cutOutline = closedRun(outline.vertices, factor);
  const sew = layered(block, "14", "POLYLINE")[0];
  const grain = layered(block, "7", "LINE")[0] ?? layered(block, "5", "LINE")[0];
  const fold = lineOf(layered(block, "6", "LINE")[0], factor);
  const turn = layered(block, "2", "POINT").map((e): Point => [round2(num(e, 10) * factor), round2(num(e, 20) * factor)]);
  const writtenId = first.get("PIECE ID");
  const id = writtenId && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(writtenId) ? writtenId.slice(0, 64) : pieceIdFromName(label);
  const stated = namedLandmarks(all, factor);
  const detected = Object.keys(stated).length > 0 ? { landmarks: stated, problem: null } : detectLandmarks(id, cutOutline, turn);
  if (detected.problem) warn(`${label}: ${detected.problem} Its landmarks were not found.`);
  const outlineText = first.get("OUTLINE");
  const lines = [...layered(block, "8", "POLYLINE").map((e) => closedRunOpen(e.vertices, factor)), ...layered(block, "8", "LINE").flatMap((e) => lineAsRun(e, factor))];
  const candidate: PatternPiece = {
    id,
    name: label.slice(0, 120),
    sizeLabel: sizeLabel.slice(0, 16),
    ...quantityOf(first.get("QUANTITY"), warn),
    onFold: fold !== null,
    outlineKind: (OUTLINE_KINDS as readonly string[]).includes(outlineText ?? "") ? (outlineText as PatternPiece["outlineKind"]) : sew ? "with-seam-allowance" : "unknown",
    cutOutline,
    sewLine: sew ? closedRun(sew.vertices, factor) : null,
    notches: notchesOf(block, factor),
    seamAllowance: allowancesOf(all),
    grainLine: lineOf(grain, factor),
    foldLine: fold,
    internalLines: lines.filter((line) => line.length >= 2),
    landmarks: detected.landmarks,
  };
  const annotation = first.get("ANNOTATION");
  if (annotation && annotation.toUpperCase() !== "CUT") warn(`"${label}" is marked "${annotation}" rather than CUT.`);
  for (const layer of new Set(block.entities.map((e) => e.layer).filter((l) => !KNOWN_LAYERS.has(l)))) {
    const count = block.entities.filter((e) => e.layer === layer).length;
    warn(`"${label}": layer ${layer} holds ${count} ${count === 1 ? "item" : "items"} this library does not use. They were left out.`);
  }
  const parsed = patternPieceSchema.safeParse(candidate);
  if (!parsed.success) {
    warn(`"${label}" could not be read as a pattern piece (${parsed.error.issues[0]?.message ?? "invalid"}), so it was left out.`);
    return null;
  }
  return parsed.data;
}

const closedRunOpen = (vertices: readonly (readonly [number, number])[], factor: number): Point[] =>
  vertices.map(([x, y]): Point => [round2(x * factor), round2(y * factor)]);

const lineAsRun = (entity: DxfEntity, factor: number): Point[][] => {
  const line = lineOf(entity, factor);
  return line ? [[line.from, line.to]] : [];
};

function unitFactor(doc: DxfDocument, fileText: Map<string, string>, warn: (s: string) => void): number {
  const code = doc.header["$INSUNITS"];
  if (code !== undefined && code !== "0") {
    const factor = UNIT_FACTORS[code];
    if (factor === undefined) throw new Error(`The file's units (code ${code}) are not ones the library reads.`);
    return factor;
  }
  const units = fileText.get("UNITS")?.toUpperCase();
  if (units === "ENGLISH") return 25.4;
  if (units !== "METRIC") warn("The file does not state its units, so they were read as millimetres.");
  return 1;
}

/** Reads every piece of every size in a DXF. */
export function readDxf(source: string): ReadDxfResult {
  const doc = parseDxf(source);
  const warnings: string[] = [];
  const warn = (sentence: string): void => {
    if (!warnings.includes(sentence)) warnings.push(sentence);
  };
  const fileText = annotations(doc.entities).first;
  const factor = unitFactor(doc, fileText, warn);
  const fileSize = fileText.get("SAMPLE SIZE") ?? null;
  const pieces = doc.blocks.flatMap((block) => {
    const piece = pieceFromBlock(block, { factor, fileSize, warn });
    return piece ? [piece] : [];
  });
  if (pieces.length === 0) warn("No pieces were found in the file.");
  return { pieces: uniqueIds(assignNotchSeams(pieces)), warnings, info: { styleName: fileText.get("STYLE NAME") ?? null, sampleSize: fileSize } };
}

/** Two pieces of one size with the same name keep apart by a number. */
function uniqueIds(pieces: readonly PatternPiece[]): PatternPiece[] {
  const seen = new Map<string, number>();
  return pieces.map((piece) => {
    const k = `${piece.sizeLabel}/${piece.id}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n === 1 ? piece : { ...piece, id: `${piece.id}-${n}`.slice(0, 64) };
  });
}

/** A notch the file does not name a seam for takes the seam it lies on. */
function assignNotchSeams(pieces: readonly PatternPiece[]): PatternPiece[] {
  const sizes = [...new Set(pieces.map((p) => p.sizeLabel))];
  const fixed = new Map<PatternPiece, PatternPiece>();
  for (const size of sizes) {
    const ofSize = pieces.filter((p) => p.sizeLabel === size);
    const seams = seamsOf(ofSize);
    for (const piece of ofSize) {
      if (!piece.notches.some((n) => n.seamId === "unassigned")) continue;
      const own = seams.get(piece.id) ?? [];
      const notches = piece.notches.map((n) => {
        if (n.seamId !== "unassigned") return n;
        const nearest = own
          .map((seam) => ({ seam, d: Math.min(...seam.points.map((p) => dist(p, n.at))) }))
          .sort((a, b) => a.d - b.d)[0];
        return nearest && nearest.d <= 1 ? { ...n, seamId: nearest.seam.seamId } : n;
      });
      fixed.set(piece, { ...piece, notches });
    }
  }
  return pieces.map((p) => fixed.get(p) ?? p);
}
