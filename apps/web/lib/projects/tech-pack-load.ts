import type { SupabaseClient } from "@supabase/supabase-js";
import { brandChartSet } from "@/lib/charts/service";
import type { ImageBytes } from "@/lib/flat/images";
import { loadIllustrations, type LoadedIllustrations } from "@/lib/images/illustrations";
import { latestImages } from "@/lib/images/service";
import type { ChartSet } from "@/lib/sizing";
import { createFileReader, type StoredBytes } from "@/lib/storage/read";
import { loadArtworkImages, type LoadedPictures } from "./artwork-images";
import { getProjectAt, listVersions, type OpenProject, type VersionsPage } from "./service";
import { historyIsNewer } from "./tech-pack-data";

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
}

export interface LoadOptions {
  /** The version to read. The current version when missing. A version the design does not have is not found. */
  readonly version?: number;
  /** How pictures are shrunk: for the screen, or for print. */
  readonly shrink: (file: StoredBytes) => Promise<ImageBytes | null>;
  /** The most bytes of pictures to embed. The screen limit when missing. */
  readonly maxEmbeddedBytes?: number;
}

const readBoth = (client: SupabaseClient, brandId: string, projectId: string, version?: number) =>
  Promise.all([getProjectAt(client, brandId, projectId, version), listVersions(client, brandId, projectId)]);

/**
 * Reads one version of a design, its history and the pictures its artwork uses, all through the
 * signed-in user's own client. A design that is missing or belongs to another brand, and a version
 * the design does not have, all throw `not_found`. The page and the export route both use this, so
 * the two are made from the same reads.
 *
 * When the current version is read, a save that lands between the two reads leaves the history
 * ahead of the design, and the reads are made again once. A named version cannot change, so it is
 * read once.
 */
export async function loadTechPackSource(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  options: LoadOptions,
): Promise<TechPackSource> {
  const reader = createFileReader(client, brandId);
  const [first, currentCharts, illustrations] = await Promise.all([
    readBoth(client, brandId, projectId, options.version),
    brandChartSet(client, brandId),
    latestImages(client, brandId, projectId).then((latest) => loadIllustrations(reader, latest)),
  ]);
  let [project, history] = first;
  if (options.version === undefined && historyIsNewer(project, history)) {
    [project, history] = await readBoth(client, brandId, projectId);
  }
  // The current version is shown with the charts in use now, as the editor shows it. An older
  // version keeps the charts that applied when it was saved, so a later import leaves it as it was.
  const charts = historyIsNewer(project, history)
    ? await brandChartSet(client, brandId, project.versionSavedAt)
    : currentCharts;
  const pictures = await loadArtworkImages(
    reader,
    options.shrink,
    project.spec,
    options.maxEmbeddedBytes === undefined ? {} : { maxEmbeddedBytes: options.maxEmbeddedBytes },
  );
  return { project, history, pictures, charts, illustrations };
}
