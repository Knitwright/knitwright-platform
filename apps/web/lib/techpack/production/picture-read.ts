import type { ArtworkStack } from "@/lib/artwork-stack";
import { ACCURACY_LIMITS, CLOSE_READING, confidenceLabel } from "@/lib/design-import/report";
import { textCell, TBC, type Cell } from "../cell";
import type { PictureRead } from "./input";
import type { PictureReadBlock } from "./types-art";

export const READ_FROM_PICTURE = `Read from a picture. This is a ${CLOSE_READING}. Compare it with the picture before printing.`;

const acceptanceCell = (read: PictureRead | null): Cell =>
  read?.acceptedBy ? textCell(`${read.acceptedBy.name} on ${read.acceptedBy.date}`, "user-edited") : TBC;

/** The layers read from a picture that the user's acceptance does not name. With no acceptance on record, every one of them. */
function notAccepted(stack: ArtworkStack | null, read: PictureRead | null): string[] {
  const layers = stack?.layers.filter((layer) => layer.provenance === "read-from-image") ?? [];
  const accepted = read?.acceptedBy ? (read.acceptedLayerIds ?? []) : [];
  return layers.filter((layer) => !accepted.includes(layer.id)).map((layer) => layer.name ?? layer.id);
}

/**
 * What the tech pack says about a design read from a picture (W7d): the report and its limits, always, and the user's
 * acceptance by name and date. Null when no layer came from a picture and no reading is on record.
 */
export function pictureBlock(stack: ArtworkStack | null, read: PictureRead | null): PictureReadBlock | null {
  const fromPicture = stack?.layers.some((layer) => layer.provenance === "read-from-image") ?? false;
  if (!fromPicture && read === null) return null;
  const report = read?.report ?? null;
  const left = notAccepted(stack, read);
  return {
    closeReading: READ_FROM_PICTURE,
    summary: report?.summary ?? null,
    pictureNote: report?.pictureNote ?? null,
    confidence: report ? confidenceLabel(report.confidence) : null,
    limits: ACCURACY_LIMITS,
    items: (report?.items ?? []).map((item) => ({ label: item.label, confidence: confidenceLabel(item.confidence), note: item.note })),
    emptyViews: (report?.emptyViews ?? []).map((view) => view.sentence),
    guessed: report?.guessed ?? [],
    notes: report?.notes ?? [],
    fittedTo: report?.fittedTo ?? null,
    acceptedBy: acceptanceCell(read),
    notAccepted: left,
    accepted: read?.acceptedBy != null && left.length === 0,
  };
}
