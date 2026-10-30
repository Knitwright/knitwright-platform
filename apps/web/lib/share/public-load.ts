import type { ImageBytes } from "@/lib/flat/images";
import { loadArtworkImages, picturesNote } from "@/lib/projects/artwork-images";
import { readSpec } from "@/lib/projects/project-reads";
import type { ChartSet } from "@/lib/sizing";
import type { FileReader, StoredBytes } from "@/lib/storage/read";
import { buildSharePage, type SharePageData } from "./public-view";
import type { OpenShare } from "./service";
import { isShareToken } from "./token";

/**
 * Reads and draws a share page from a token. Everything is read for the brand the token's link
 * belongs to, never for a brand a visitor names: the design through the token, the brand's size
 * charts, and only the stored pictures the shared version's artwork points at. The pictures are
 * read on the server and drawn into the page, so no storage address ever reaches the visitor.
 */

export interface ShareLoadDeps {
  readonly open: (token: string) => Promise<OpenShare | null>;
  /** The brand's size charts, as they were at the moment given, or as they are now. */
  readonly charts: (brandId: string, at?: string) => Promise<ChartSet>;
  /** Reads the brand's stored files by id. */
  readonly reader: (brandId: string) => FileReader;
  readonly shrink: (file: StoredBytes) => Promise<ImageBytes | null>;
}

interface LoadedSharePage {
  readonly page: SharePageData;
  readonly picturesNote: string | null;
  /**
   * Whether the answer form is offered (plan v5 Y8). A share link is answered through, as decision
   * 0026 built. An invite is one person's own, and `share_respond` takes a link's token only, so an
   * invited person is shown the design and no form rather than a form that would refuse them.
   */
  readonly canAnswer: boolean;
  /** One line saying how the reader got here, where that is not an ordinary share link. */
  readonly inviteNote: string | null;
}

/** The page for a token, or null when the token opens nothing. */
export async function loadSharePage(deps: ShareLoadDeps, token: string): Promise<LoadedSharePage | null> {
  if (!isShareToken(token)) return null;
  const opened = await deps.open(token);
  if (!opened) return null;
  const { spec } = readSpec(opened.spec);
  // The current version is drawn with the charts in use now, as the editor draws it. An older one
  // keeps the charts that applied when it was saved, as its tech pack does.
  const charts = await deps.charts(opened.brandId, opened.isCurrent ? undefined : opened.savedAt);
  const pictures = await loadArtworkImages(deps.reader(opened.brandId), deps.shrink, spec);
  const page = buildSharePage({
    projectName: opened.projectName,
    brandName: opened.brandName,
    version: opened.version,
    savedAt: opened.savedAt,
    expiresAt: opened.expiresAt,
    spec,
    charts,
    images: pictures.images,
  });
  return {
    page,
    picturesNote: picturesNote(pictures.skipped),
    canAnswer: opened.openedBy === "link",
    inviteNote: opened.openedBy === "link" ? null : inviteNote(opened.brandName),
  };
}

/** What an invited reader is told: who shared it, and that this invite is theirs alone. */
export const inviteNote = (brandName: string): string =>
  `${brandName} invited you to this design. The link works for you alone.`;
