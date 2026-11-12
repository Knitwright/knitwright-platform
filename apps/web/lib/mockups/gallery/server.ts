import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brandChartSet } from "@/lib/charts/service";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";
import { zipSync, type Zippable } from "fflate";
import { safeName } from "@/lib/flows/zip";
import { flatModels } from "@/lib/images/reference";
import { loadArtworkImages } from "@/lib/projects/artwork-images";
import { getProjectAt } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { createFileReader } from "@/lib/storage/read";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { composeMockup } from "../compose";
import { drawGarment, NO_DRAWING_LINE } from "../garment";
import { loadMockupScenes } from "../service";
import { downloadable } from "./cards";

/**
 * The Mockups page's reads and its download (decision 0140). Free and deterministic: the same
 * design, colourway and scene give the same bytes every time, and nothing paid is called.
 */

const FIXED_TIME = new Date(Date.UTC(2020, 0, 1));

export interface ProductOnPage {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly colourways: readonly Readonly<{ id: string; name: string }>[];
  /** The colourway drawn: the one asked for when the design has it, or its first. */
  readonly colourwayId: string;
  /** The front and back drawings, as data addresses; null for a garment the platform cannot draw. */
  readonly front: string | null;
  readonly back: string | null;
  readonly alt: string;
}

/** The chosen design, drawn once for every card on the page. */
export async function productOnPage(client: SupabaseClient, brandId: string, designId: string, colourwayId: string | null): Promise<ProductOnPage> {
  const [project, charts] = await Promise.all([getProjectAt(client, brandId, designId), brandChartSet(client, brandId)]);
  const colourways = project.spec.colourways.map((one) => ({ id: one.id, name: one.name }));
  const chosen = colourways.find((one) => one.id === colourwayId)?.id ?? colourways[0]!.id;
  const models = flatModels(project.spec, charts, chosen);
  return {
    id: project.id,
    name: project.name,
    version: project.currentVersion,
    colourways,
    colourwayId: chosen,
    front: models === null ? null : svgDataUri(renderSvg(models.front)),
    back: models === null ? null : svgDataUri(renderSvg(models.back)),
    alt: models === null ? "" : models.front.description,
  };
}

export interface DownloadAsk {
  readonly designId: string;
  readonly colourwayId: string | null;
  readonly slugs: readonly string[];
}

export interface DownloadFile {
  readonly bytes: Uint8Array;
  readonly name: string;
  readonly type: "image/png" | "application/zip";
}

/** The scenes asked for that this page can draw, in the order asked. */
async function scenesFor(client: SupabaseClient, slugs: readonly string[]) {
  const { scenes } = await loadMockupScenes(client);
  const picked = slugs.flatMap((slug) => scenes.filter((one) => one.scene.slug === slug && downloadable(one.scene)).map((one) => one.scene));
  if (picked.length === 0) throw new AppError("not_found", "None of those mockups can be downloaded here. An AI scene or a chart card is made on a launch canvas.");
  return picked;
}

/** One PNG, or a zip of several, of the design on the scenes asked for. */
export async function downloadMockups(client: SupabaseClient, brandId: string, ask: DownloadAsk): Promise<DownloadFile> {
  const [project, charts, scenes] = await Promise.all([getProjectAt(client, brandId, ask.designId), brandChartSet(client, brandId), scenesFor(client, ask.slugs)]);
  const { images } = await loadArtworkImages(createFileReader(client, brandId), shrinkForDrawing, project.spec);
  const colourwayId = project.spec.colourways.find((one) => one.id === ask.colourwayId)?.id;
  const drawings = await drawGarment({ spec: project.spec, charts, images, edge: 1600, ...(colourwayId === undefined ? {} : { colourwayId }) });
  if (drawings === null) throw new AppError("unavailable", NO_DRAWING_LINE);
  const pictures = await Promise.all(scenes.map((scene) => composeMockup({ scene, drawings })));
  const base = safeName(project.name);
  if (pictures.length === 1) return { bytes: pictures[0]!.png, name: `${base}-${scenes[0]!.slug}.png`, type: "image/png" };
  // Pictures are already compressed; no clock goes in, so the same ask gives the same zip.
  const tree: Zippable = Object.fromEntries(pictures.map((picture, at) => [`${base}-${scenes[at]!.slug}.png`, [picture.png, { level: 0, mtime: FIXED_TIME }]]));
  return { bytes: zipSync(tree), name: `${base}-mockups.zip`, type: "application/zip" };
}
