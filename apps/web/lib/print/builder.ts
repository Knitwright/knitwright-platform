import { VIEW_IDS, type ViewId } from "@/lib/artwork-stack";
import { printFileResultSchema, type PrintFileBuilder, type PrintFileResult, type PrintFileSpec } from "@/lib/production/contract";
import type { BuildEnv } from "./layout/context";
import { buildPieceScene } from "./layout/piece-scene";
import type { PlayerTag } from "./layout/scene";
import { renderFile } from "./render/files";

export interface PrintBuilderDeps {
  /** The design, pattern, colourway, assets, rules and font of the release. The spec below overrides the print parameters. */
  readonly env: BuildEnv;
  /** The roster of the release, to find a player's name from the number a spec names. */
  readonly roster?: readonly { readonly name: string; readonly number: string; readonly sizeLabel?: string }[];
}

const isView = (id: string): id is ViewId => (VIEW_IDS as readonly string[]).includes(id);

/** A spec names a view ("back", "sleeve-left") or a pattern piece that has one view ("collar"). A pair such as "sleeve" must say which. */
export function viewOfPieceId(env: BuildEnv, pieceId: string, size: string): ViewId {
  if (isView(pieceId)) return pieceId;
  const views = env.mapper.views(size).filter((v) => env.mapper.frame(v, size)?.pieceId === pieceId);
  if (views.length === 1) return views[0];
  throw new RangeError(views.length === 0 ? `There is no piece called ${pieceId} in size ${size}.` : `${pieceId} is cut as a pair: ask for ${views.join(" or ")}.`);
}

/** The environment with the print parameters a release froze: its bleed, resolution and scale replace the live settings. */
export function envForSpec(env: BuildEnv, spec: PrintFileSpec): BuildEnv {
  return {
    ...env,
    settings: {
      ...env.settings,
      bleedMm: spec.bleedMm,
      dpi: spec.dpi,
      iccFileId: spec.profile.iccFileId,
      maxPrintWidthMm: spec.profile.maxPrintWidthMm,
      source: spec.profile.source,
    },
    // scaleX is across the piece and scaleY along its length (the way the fabric runs).
    scale: { length: spec.scaleY, width: spec.scaleX, note: env.scale.note },
  };
}

/**
 * The print files as a release (W4) needs them: one file per spec, the same bytes for the same inputs. The builder holds
 * what is fixed for a release (the design, the pattern, the assets) and takes the rest from each spec, so a reorder from a
 * frozen release rebuilds the files its hashes name.
 */
export function createPrintFileBuilder(deps: PrintBuilderDeps): PrintFileBuilder {
  return {
    async build(spec) {
      const env = envForSpec(deps.env, spec);
      const view = viewOfPieceId(env, spec.pieceId, spec.size);
      const row = spec.playerNumber === undefined ? undefined : deps.roster?.find((r) => r.number === spec.playerNumber);
      const player: PlayerTag | undefined = spec.playerNumber === undefined ? undefined : { name: row?.name ?? "", number: spec.playerNumber };
      const scene = await buildPieceScene(env, { view, size: spec.size, ...(player === undefined ? {} : { player }), ...(row?.sizeLabel === undefined ? {} : { sizeLabel: row.sizeLabel }) });
      if (scene === null) throw new RangeError(`There is no ${spec.pieceId} piece in size ${spec.size}.`);
      const file = await renderFile(scene, spec.format, { font: env.font, settings: env.settings });
      const result: PrintFileResult = printFileResultSchema.parse({
        sha256: file.sha256,
        pageWidthMm: file.pageWidthMm,
        pageHeightMm: file.pageHeightMm,
        warnings: file.warnings.slice(0, 50).map((w) => w.slice(0, 300)),
      });
      return { ...result, bytes: file.bytes };
    },
  };
}
