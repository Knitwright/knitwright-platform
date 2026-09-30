import type { View } from "@/lib/flat/model";
import type { LoadedIllustrations } from "@/lib/images/illustrations";
import { ILLUSTRATION_LABEL, versionNote } from "@/lib/images/panel-state";

/**
 * The photoreal pictures of a design as the exported files carry them (plan step 14, task 5):
 * after the specification, each labelled as an illustration. Pictures made from a later version
 * than the one exported are left out, since they may show what that version does not have.
 */

export interface ExportIllustration {
  readonly view: View;
  readonly caption: string;
  /** A data address of a small JPEG, made on the server. */
  readonly src: string;
}

export interface ExportIllustrations {
  readonly label: string;
  /** Said when the pictures were made from an older version than the file. */
  readonly note: string | null;
  readonly items: readonly ExportIllustration[];
}

export function illustrationsForExport(loaded: LoadedIllustrations | null, version: number): ExportIllustrations | null {
  if (!loaded || loaded.version > version || loaded.illustrations.length === 0) return null;
  return {
    label: ILLUSTRATION_LABEL,
    note: versionNote(loaded.version, version),
    items: loaded.illustrations.map((item) => ({
      view: item.view,
      caption: `${item.label}. Illustration, not a specification.`,
      src: item.src,
    })),
  };
}

/** The lines of the Excel sheet about the pictures. The pictures themselves are only in the PDF. */
export function illustrationSheetRows(illustrations: ExportIllustrations): readonly string[] {
  const views = illustrations.items.map((item) => item.view).join(", ");
  return [
    illustrations.label,
    ...(illustrations.note ? [illustrations.note] : []),
    `The pictures (${views}) are in the PDF of this tech pack.`,
  ];
}
