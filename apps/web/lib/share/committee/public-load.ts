import type { ImageBytes } from "@/lib/flat/images";
import { loadArtworkImages, picturesNote } from "@/lib/projects/artwork-images";
import { readSpec } from "@/lib/projects/project-reads";
import type { ChartSet } from "@/lib/sizing";
import type { FileReader, StoredBytes } from "@/lib/storage/read";
import { isShareToken } from "../token";
import { buildCommitteePage, type CommitteePageData } from "./public-view";
import type { OpenCommittee } from "./service";

/**
 * Reads and draws a committee page from a token (spec F-T3, plan v5 Z7, decision 0087).
 *
 * Everything is read for the club the token's link belongs to, never for a club a visitor names:
 * the design through the token, the club's size charts, and only the stored pictures each shared
 * version's artwork points at. The pictures are read on the server and drawn into the page, so no
 * storage address ever reaches the visitor. This is the same path a share page takes (decision
 * 0026), and it is deliberately the same: the security of a public link is the idiom, not the page.
 */

export interface CommitteeLoadDeps {
  readonly open: (token: string) => Promise<OpenCommittee | null>;
  /** The club's size charts, as they were at the moment given, or as they are now. */
  readonly charts: (brandId: string, at?: string) => Promise<ChartSet>;
  /** Reads the club's stored files by id. */
  readonly reader: (brandId: string) => FileReader;
  readonly shrink: (file: StoredBytes) => Promise<ImageBytes | null>;
}

export interface LoadedCommitteePage {
  readonly page: CommitteePageData;
  /** The versions the link shows, so a form can name one without trusting the browser. */
  readonly versions: readonly number[];
}

/** The page for a token, or null when the token opens nothing. */
export async function loadCommitteePage(deps: CommitteeLoadDeps, token: string): Promise<LoadedCommitteePage | null> {
  if (!isShareToken(token)) return null;
  const opened = await deps.open(token);
  if (!opened) return null;
  const reader = deps.reader(opened.brandId);
  // The newest version is drawn with the charts in use now, as the editor draws it. An older one
  // keeps the charts that applied when it was saved, as its tech pack does.
  const options = await Promise.all(
    opened.options.map(async (option) => {
      const { spec } = readSpec(option.spec);
      const pictures = await loadArtworkImages(reader, deps.shrink, spec);
      return {
        slot: option.slot,
        version: option.version,
        savedAt: option.savedAt,
        isCurrent: option.isCurrent,
        spec,
        images: pictures.images,
        picturesNote: picturesNote(pictures.skipped),
      };
    }),
  );
  const newest = opened.options.some((option) => option.isCurrent);
  const charts = await deps.charts(opened.brandId, newest ? undefined : opened.options[0]?.savedAt);
  return {
    page: buildCommitteePage({
      projectName: opened.projectName,
      brandName: opened.brandName,
      expiresAt: opened.expiresAt,
      lockedVersion: opened.lockedVersion,
      options,
      charts,
    }),
    versions: options.map((option) => option.version),
  };
}
