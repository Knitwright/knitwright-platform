import type { SupabaseClient } from "@supabase/supabase-js";
import { brandChartSet } from "@/lib/charts/service";
import type { ImageBytes } from "@/lib/flat/images";
import { loadIllustrations, type LoadedIllustrations } from "@/lib/images/illustrations";
import { latestImages, type LatestImages } from "@/lib/images/service";
import type { GarmentSpec } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { createFileReader, type StoredBytes } from "@/lib/storage/read";
import { loadArtworkImages, type LoadedPictures } from "./artwork-images";
import { loadMemberNames, type MemberNames } from "./member-names";
import { getProjectAt, listVersions, type OpenProject, type VersionsPage } from "./service";
import { historyIsNewer } from "./tech-pack-data";
import { loadProduction, readersFor } from "./tech-pack-production";
import type { ProductionInput } from "@/lib/techpack/production/input";

/**
 * What the tech pack page and every export are made from: the design, its history, its pictures,
 * the size charts that apply (the platform's, with the brand's own in their place, as they were
 * when an older version was saved) and the AI
 * illustrations, if any were made.
 */
export interface TechPackSource {
  readonly project: OpenProject;
  readonly history: VersionsPage;
  readonly pictures: LoadedPictures;
  readonly charts: ChartSet;
  /** The newest AI pictures of the design, or null when none were made. */
  readonly illustrations: LoadedIllustrations | null;
  /** The names of the brand's members, for "Made by" in the revision history. */
  readonly memberNames: MemberNames;
  /** What the production services know about the design: its pictures, print profile, release, strike-off and the reading it came from. */
  readonly production?: ProductionInput;
}

/** The rows a tech pack is made from, before any stored picture is read. */
export interface TechPackReads {
  readonly project: OpenProject;
  readonly history: VersionsPage;
  readonly charts: ChartSet;
  readonly memberNames: MemberNames;
  readonly production: ProductionInput;
  /** Which AI pictures were made last, not yet read, or null when none were made. */
  readonly latest: LatestImages | null;
}

export interface PictureOptions {
  /** How pictures are shrunk: for the screen, or for print. */
  readonly shrink: (file: StoredBytes) => Promise<ImageBytes | null>;
  /** The most bytes of pictures to embed. The screen limit when missing. */
  readonly maxEmbeddedBytes?: number;
}

export interface LoadOptions extends PictureOptions {
  /** The version to read. The current version when missing. A version the design does not have is not found. */
  readonly version?: number;
}

const readBoth = (client: SupabaseClient, brandId: string, projectId: string, version?: number) =>
  Promise.all([getProjectAt(client, brandId, projectId, version), listVersions(client, brandId, projectId)]);

/**
 * Reads one version of a design, its history, the size charts and the members' names, all at
 * once, through the signed-in user's own client. A design that is missing or belongs to another
 * brand, and a version the design does not have, all throw `not_found`.
 *
 * When the current version is read, a save that lands between the two reads leaves the history
 * ahead of the design, and the reads are made again once. A named version cannot change, so it is
 * read once.
 */
export async function readTechPack(client: SupabaseClient, brandId: string, projectId: string, version?: number): Promise<TechPackReads> {
  const [first, currentCharts, latest, memberNames] = await Promise.all([
    readBoth(client, brandId, projectId, version),
    brandChartSet(client, brandId),
    latestImages(client, brandId, projectId),
    loadMemberNames(client, brandId),
  ]);
  let [project, history] = first;
  if (version === undefined && historyIsNewer(project, history)) {
    [project, history] = await readBoth(client, brandId, projectId);
  }
  // The current version is shown with the charts in use now, as the editor shows it. An older
  // version keeps the charts that applied when it was saved, so a later import leaves it as it was.
  const charts = historyIsNewer(project, history)
    ? await brandChartSet(client, brandId, project.versionSavedAt)
    : currentCharts;
  const production = await loadProduction(readersFor(client, brandId, projectId), { spec: project.spec, names: memberNames });
  return { project, history, charts, memberNames, production, latest };
}

/** The pictures a design's artwork uses, read from storage and shrunk. */
export const readArtworkPictures = (
  client: SupabaseClient,
  brandId: string,
  spec: GarmentSpec,
  options: PictureOptions,
): Promise<LoadedPictures> =>
  loadArtworkImages(
    createFileReader(client, brandId),
    options.shrink,
    spec,
    options.maxEmbeddedBytes === undefined ? {} : { maxEmbeddedBytes: options.maxEmbeddedBytes },
  );

/** The AI illustrations named by `latest`, read from storage, or null when there are none to show. */
export const readIllustrations = (client: SupabaseClient, brandId: string, latest: LatestImages | null): Promise<LoadedIllustrations | null> =>
  loadIllustrations(createFileReader(client, brandId), latest);

/**
 * Everything a tech pack is made from, pictures included. The export route uses this; the page
 * uses the same reads, and streams the pictures in as they arrive.
 */
export async function loadTechPackSource(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  options: LoadOptions,
): Promise<TechPackSource> {
  const { project, history, charts, memberNames, production, latest } = await readTechPack(client, brandId, projectId, options.version);
  const [pictures, illustrations] = await Promise.all([
    readArtworkPictures(client, brandId, project.spec, options),
    readIllustrations(client, brandId, latest),
  ]);
  return { project, history, pictures, charts, illustrations, memberNames, production };
}
