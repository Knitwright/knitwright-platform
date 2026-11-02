import type { OfferedAsset } from "@/components/marketing/services";
import { BOARDS, isGeneratedKind, type LaunchProjectView } from "@/lib/launch";
import type { BrandVoice, ExportTarget, WatermarkRule } from "@/lib/marketing";

/**
 * WHAT THE SHELL CAN HONESTLY HAND A MARKETING PANEL (the wiring of decision 0094).
 *
 * `MarketingServicesProvider` (`components/marketing/services.tsx`) is the one way anything reaches
 * a marketing panel from outside `LaunchPanelProps`, and every entry of it has an honest default.
 * This file fills the entries the shell really knows, and leaves the rest at those defaults:
 *
 *   * **pictures**: worked out here from the canvas itself. A board the platform draws -- a design,
 *     an artboard, a mockup, a marketing board or an info card -- holds a picture the platform drew,
 *     so its finished output may be offered for a slot. A board a model draws (`isGeneratedKind`)
 *     is left out, which is the garment lock said once more at the only place a picture enters a
 *     marketing layout: `fillSlot` refuses a generated provenance anyway, and nothing here can even
 *     name one.
 *   * **thumbnail**: null. A launch file is private and has no address a page may put in an `img`
 *     without a route to serve it, so the panel shows the board's name instead of a broken picture.
 *   * **fills**: left empty. The repeat maker (decision 0081) publishes nothing to a library yet,
 *     so there is no repeat print of a brand to offer and the panel shows its empty state.
 *   * **onExport**: left null. The export panel's own route does not exist, so it says it is not
 *     connected rather than starting an export that goes nowhere.
 */

/** The rows and the brand's own words the page reads for the marketing panels. */
export type MarketingShellData = Readonly<{
  /** The brand's voice and tone from Brand Studio's record, or null when none is on file. */
  voice: BrandVoice | null;
  targets: readonly ExportTarget[];
  watermarkRules: readonly WatermarkRule[];
}>;

/** A mockup is a PNG; nothing on a launch canvas is stored as anything else today. */
const DRAWN_TYPE = "image/png";

/**
 * The pictures of this canvas a marketing slot may be filled with: the finished output of every
 * board the platform draws itself. In canvas order, so the list reads as the canvas does.
 */
export function drawnPictures(project: LaunchProjectView): readonly OfferedAsset[] {
  return project.boards
    .filter((board) => board.outputFileId !== null && !isGeneratedKind(board.kind))
    .map((board) => ({
      fileId: board.outputFileId as string,
      label: board.name || BOARDS[board.kind].label,
      contentType: DRAWN_TYPE,
      provenance: "deterministic" as const,
      thumbnail: null,
    }));
}
