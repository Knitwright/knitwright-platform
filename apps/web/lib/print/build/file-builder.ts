import { createHash } from "node:crypto";
import type { ArtworkStack, AssetReader, PatternGenerator } from "@/lib/artwork-stack";
import { GENERATORS } from "@/lib/pattern-generators";
import type { GradedPattern, PrintFileBuilder, PrintFileResult, PrintFileSpec, PrintRuleSet, RosterRow } from "@/lib/production/contract";
import { frameFor } from "../frames/frame";
import { buildPieceScene, type BuiltScene } from "../layout/build-scene";
import { fieldBoundsFor } from "../layout/field";
import { seamJoinFor } from "../layout/seam";
import { createPieceMapper, type PrintMapper } from "../layout/mapper";
import type { PrintSettings } from "../layout/types";
import { renderPdf, renderSvgAsync, renderTiff } from "../render";
import { pageSizeMm, type PieceScene } from "../scene";
import { buildZones } from "../zones/build";
import { zoneTemplatesFor } from "../zones/templates";

export interface BuilderDeps {
  readonly pattern: GradedPattern;
  readonly stack: ArtworkStack;
  readonly colourwayId: string;
  readonly assets: AssetReader;
  readonly rules: PrintRuleSet;
  /** The team list the player files are made from, or null. */
  readonly roster: Roster | null;
  readonly garment: string;
  readonly minDpi: number;
  readonly scaleNote: string | null;
  readonly defaultsNote: string | null;
  readonly patternReviewed: boolean;
  /** Which pattern and who reviewed it, said in every margin. */
  readonly patternNote?: string;
  /** Every pattern style the platform can draw (W7c). Tests may pass their own. */
  readonly generators?: readonly PatternGenerator[];
  readonly mapper?: PrintMapper;
  /** The print house's ICC profile bytes, when the brand has uploaded one. */
  readonly icc?: Uint8Array;
}

export interface BuiltFile extends PrintFileResult {
  readonly bytes: Uint8Array;
  readonly scene: BuiltScene;
}

interface FileOptions {
  readonly transferOnly?: boolean;
}

/** The seam join as a layout field, left out when the pattern has no underarm landmark to join by. */
const joinOf = (placed: Parameters<typeof seamJoinFor>[0]): { seamJoinMm?: number } => {
  const join = seamJoinFor(placed);
  return join === undefined ? {} : { seamJoinMm: join };
};

/** Layouts kept so the PDF, SVG and TIFF of one piece share one. Few, because a layout holds its pictures and a release asks for thousands of files. */
const KEPT_SCENES = 8;

const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** What the files need of a team order (W4): its rows. */
export type Roster = { readonly rows: readonly RosterRow[] };

const rowFor = (roster: Roster | null, number: string | undefined): RosterRow | null =>
  number === undefined ? null : (roster?.rows.find((row) => row.number === number) ?? null);

const settingsFor = (spec: PrintFileSpec, deps: BuilderDeps): PrintSettings => ({
  bleedMm: spec.bleedMm,
  dpi: spec.dpi,
  minDpi: deps.minDpi,
  scaleX: spec.scaleX,
  scaleY: spec.scaleY,
  scaleNote: spec.scaleX === 1 && spec.scaleY === 1 ? deps.scaleNote : null,
  defaultsNote: deps.defaultsNote,
  patternReviewed: deps.patternReviewed,
  patternNote: deps.patternNote ?? null,
});

/** The bytes of one file in the format asked for. A TIFF may also carry a note about its resolution. */
async function renderBytes(spec: PrintFileSpec, art: PieceScene, deps: BuilderDeps): Promise<{ bytes: Uint8Array; dpiNote?: string | null }> {
  if (spec.format === "pdf") return { bytes: await renderPdf(art) };
  if (spec.format === "svg") return { bytes: new TextEncoder().encode(await renderSvgAsync(art)) };
  const tiff = await renderTiff(art, deps.icc ? { icc: deps.icc } : {});
  return { bytes: tiff.bytes, dpiNote: tiff.dpiNote };
}

/**
 * Builds print files for one design on one pattern. It implements the contract's `PrintFileBuilder` (what a release
 * hashes) and adds `buildFile`, which also hands back the scene for the checks. Scenes are kept so the PDF, SVG and
 * TIFF of one piece are made from one layout. Deterministic: the same inputs give the same bytes.
 */
export function createPrintFileBuilder(deps: BuilderDeps): PrintFileBuilder & { buildFile(spec: PrintFileSpec, options?: FileOptions): Promise<BuiltFile>; readonly mapper: PrintMapper } {
  const mapper = deps.mapper ?? createPieceMapper(deps.pattern);
  const zones = buildZones(zoneTemplatesFor(deps.garment), deps.pattern, mapper.anchors);
  const generators = deps.generators ?? GENERATORS;
  const scenes = new Map<string, Promise<BuiltScene>>();

  const sceneFor = (spec: PrintFileSpec, options: FileOptions): Promise<BuiltScene> => {
    const key = JSON.stringify([spec.pieceId, spec.size, spec.playerNumber ?? null, spec.bleedMm, spec.scaleX, spec.scaleY, spec.dpi, options.transferOnly ?? false]);
    const known = scenes.get(key);
    if (known) return known;
    const placed = mapper.placed(spec.size);
    const mine = placed.find((entry) => entry.instance.id === spec.pieceId);
    if (!mine) return Promise.reject(new RangeError(`There is no piece ${spec.pieceId} in size ${spec.size}.`));
    const settings = settingsFor(spec, deps);
    const made = buildPieceScene({
      stack: deps.stack,
      colourwayId: deps.colourwayId,
      instance: mine.instance,
      frame: frameFor(mine.instance, mapper.anchors),
      anchors: (mapper.anchors[mine.instance.view] ?? {}) as never,
      zones,
      field: fieldBoundsFor(placed, mapper.anchors.front?.underarm?.y ?? 0),
      ...joinOf(placed),
      settings,
      rules: deps.rules,
      generators,
      assets: deps.assets,
      player: rowFor(deps.roster, spec.playerNumber),
      ...(options.transferOnly ? { transferOnly: true } : {}),
    });
    scenes.set(key, made);
    for (const old of [...scenes.keys()].slice(0, Math.max(0, scenes.size - KEPT_SCENES))) scenes.delete(old);
    return made;
  };

  const buildFile = async (spec: PrintFileSpec, options: FileOptions = {}): Promise<BuiltFile> => {
    const scene = await sceneFor(spec, options);
    const art = scene.scene;
    const warnings = art.issues.map((issue) => issue.text.slice(0, 300));
    const { bytes, dpiNote } = await renderBytes(spec, art, deps);
    if (dpiNote) warnings.push(dpiNote);
    const page = pageSizeMm(art);
    return { sha256: sha256Of(bytes), pageWidthMm: Math.round(page.width * 100) / 100, pageHeightMm: Math.round(page.height * 100) / 100, warnings: warnings.slice(0, 50), bytes, scene };
  };

  return { mapper, buildFile, build: (spec) => buildFile(spec) };
}
