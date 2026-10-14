import type { ViewId } from "@/lib/artwork-stack";
import type { PrintFormat } from "./formats";
import type { BuildEnv } from "./layout/context";
import { buildPieceScene } from "./layout/piece-scene";
import type { PieceScene } from "./layout/scene";
import { manifestCsv, manifestJson, manifestLines, readmeText, type FileEntry } from "./manifest";
import { playerFileStem, type PlayerJob } from "./players";
import { EXTENSION_OF, renderFile } from "./render/files";
import { buildZip, type ZipEntry } from "./zip";

/** The most files one request may make. */
export const MAX_FILES = 400;

/**
 * What a file costs to make, in rough units of a quarter of a second: a PDF or an SVG is cheap, a TIFF is drawn pixel by pixel.
 * A request may cost this much, which keeps it inside the function's time limit (decision 0002).
 */
export const WORK_UNITS: Readonly<Record<PrintFormat, number>> = { pdf: 1, svg: 1, tiff: 10 };
export const WORK_LIMIT = 120;

export interface PrintRequest {
  /** Pattern sizes for the one set of pieces. */
  readonly sizes: readonly string[];
  readonly formats: readonly PrintFormat[];
  /** The views to make; every view the pattern has when missing. */
  readonly views?: readonly ViewId[];
  /** The players to make a set for. Their pieces are left out of the general set. */
  readonly players?: readonly PlayerJob[];
  readonly guides?: boolean;
  readonly maxFiles?: number;
  /** The most work a request may ask for (see `WORK_UNITS`). */
  readonly maxWork?: number;
}

export class TooManyFiles extends Error {
  constructor(readonly count: number, readonly limit: number) {
    super(`That would make ${count} files, and one request can make ${limit}. Ask for fewer sizes, pieces or formats, or split the players into groups.`);
  }
}

export class TooMuchWork extends Error {
  constructor(readonly files: number) {
    super(`That would make ${files} files, which is more than one download can draw in time (TIFF files take the longest). Ask for fewer sizes, pieces or file types, or split the players into groups.`);
  }
}

/** How many scenes a request will build, counted before any is built. */
export function plannedScenes(env: BuildEnv, request: PrintRequest): number {
  const players = request.players ?? [];
  const playerViews = new Set(players.flatMap((p) => p.views));
  const general = request.sizes.reduce((n, size) => n + (request.views ?? env.mapper.views(size)).filter((v) => !playerViews.has(v)).length, 0);
  const perPlayer = players.reduce((n, p) => n + p.views.filter((v) => request.views === undefined || request.views.includes(v)).length * (p.transfer ? 2 : 1), 0);
  return general + perPlayer;
}

const fileName = (scene: PieceScene, view: ViewId, format: PrintFormat): string => `${view}_${scene.size}.${EXTENSION_OF[format]}`;

interface Pending {
  readonly scene: PieceScene;
  readonly kind: FileEntry["kind"];
  readonly folder: string;
  readonly playerIndex: number | null;
}

async function scenesFor(env: BuildEnv, request: PrintRequest): Promise<{ pending: Pending[]; problems: string[] }> {
  const pending: Pending[] = [];
  const problems: string[] = [];
  const players = request.players ?? [];
  const playerViews = new Set(players.flatMap((p) => p.views));
  for (const size of request.sizes) {
    const views = (request.views ?? env.mapper.views(size)).filter((v) => !playerViews.has(v));
    for (const view of views) {
      const scene = await buildPieceScene(env, { view, size });
      if (scene === null) problems.push(`This pattern has no ${view.replace("-", " ")} piece in size ${size}, so none was made.`);
      else pending.push({ scene, kind: "piece", folder: "pieces", playerIndex: null });
    }
  }
  for (const job of players) {
    const folder = `players/${playerFileStem(job)}`;
    for (const view of job.views.filter((v) => request.views === undefined || request.views.includes(v))) {
      const req = { view, size: job.size, sizeLabel: job.label, player: job.player };
      const scene = await buildPieceScene(env, req);
      if (scene === null) problems.push(`${job.player.name || "A player"}: this pattern has no ${view.replace("-", " ")} piece in size ${job.size}.`);
      else pending.push({ scene, kind: "player", folder, playerIndex: job.index });
      if (job.transfer) {
        const transfer = await buildPieceScene(env, { ...req, transferOnly: true });
        if (transfer !== null) pending.push({ scene: transfer, kind: "transfer", folder: `${folder}/transfer`, playerIndex: job.index });
      }
    }
  }
  return { pending, problems };
}

export interface PrintSet {
  readonly files: readonly FileEntry[];
  /** Plain sentences for anything asked for and not made. */
  readonly problems: readonly string[];
}

/**
 * All the files a request asks for, built in memory. Sizes in the order given, pieces in the pattern's order, players in
 * the roster's order: the same request gives the same files in the same order, byte for byte.
 */
export async function buildPrintSet(env: BuildEnv, request: PrintRequest): Promise<PrintSet> {
  const planned = plannedScenes(env, request);
  const limit = request.maxFiles ?? MAX_FILES;
  if (planned * request.formats.length > limit) throw new TooManyFiles(planned * request.formats.length, limit);
  if (planned * request.formats.reduce((n, f) => n + WORK_UNITS[f], 0) > (request.maxWork ?? WORK_LIMIT)) throw new TooMuchWork(planned * request.formats.length);
  const { pending, problems } = await scenesFor(env, request);
  const files: FileEntry[] = [];
  for (const { scene, kind, folder, playerIndex } of pending) {
    for (const format of request.formats) {
      const rendered = await renderFile(scene, format, { font: env.font, settings: env.settings, ...(request.guides === undefined ? {} : { guides: request.guides }) });
      files.push({
        path: `${folder}/${fileName(scene, scene.view, format)}`,
        kind,
        pieceId: scene.pieceId,
        view: scene.view,
        size: scene.size,
        sizeLabel: scene.sizeLabel,
        player: scene.player,
        playerIndex,
        format,
        bytes: rendered.bytes,
        sha256: rendered.sha256,
        pageWidthMm: rendered.pageWidthMm,
        pageHeightMm: rendered.pageHeightMm,
        lowestDpi: scene.lowestDpi,
        flattened: scene.flattened,
        warnings: rendered.warnings,
      });
    }
  }
  return { files, problems };
}

export interface ZipInfo {
  readonly designName: string;
  readonly folderName: string;
}

/** The zip a person downloads: the files, a manifest as CSV and JSON, and a note in plain words. Built on download, never stored. */
export function zipPrintSet(env: BuildEnv, set: PrintSet, request: PrintRequest, info: ZipInfo): Uint8Array {
  const lines = manifestLines(set.files);
  const root = info.folderName;
  const entries: ZipEntry[] = [
    { path: `${root}/README.txt`, bytes: new TextEncoder().encode(readmeText({ env, designName: info.designName, fileCount: set.files.length, playerCount: request.players?.length ?? 0, problems: set.problems, formats: request.formats })) },
    { path: `${root}/manifest.csv`, bytes: new TextEncoder().encode(manifestCsv(lines)) },
    { path: `${root}/manifest.json`, bytes: new TextEncoder().encode(manifestJson(lines, { design: info.designName, bleedMm: env.settings.bleedMm, dpi: env.settings.dpi, scale: { length: env.scale.length, width: env.scale.width, note: env.scale.note }, patternReviewed: env.patternReviewed, problems: set.problems })) },
    ...set.files.map((f) => ({ path: `${root}/${f.path}`, bytes: f.bytes })),
  ];
  return buildZip(entries);
}
