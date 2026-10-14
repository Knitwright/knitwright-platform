import { parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";
import type { ModelImageType, TextModelProvider } from "@/lib/providers/text-model";
import { MODEL_IMAGE_TYPES } from "@/lib/providers/text-model";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import { TOO_LARGE, type StoredBytes } from "@/lib/storage/read";
import type { Budget } from "./budget";
import type { ImageCleanup } from "./cleanup";
import { decodeForAnalysis } from "./decode";
import { importFromPicture, refitView } from "./pipeline";
import type { ImportReport } from "./report";
import type { ImportRecord, ImportStore, Who } from "./store";
import type { TemplateSource } from "./template";
import {
  IMPORT_CLOSED,
  IMPORT_NOT_FOUND,
  IMPORT_NOT_READY,
  PICTURE_NOT_FOUND,
  PICTURE_NOT_OPENED,
  PICTURE_TOO_LARGE,
  READ_FAILED,
  SWITCHED_OFF,
} from "./wording";
import type { LandmarkHint } from "./landmarks";
import type { ViewId } from "@/lib/artwork-stack";

/**
 * The work behind reading a design from a picture, with every outside service passed in. The picture is read from
 * the brand's own files, analysed, and kept as a PROPOSAL row. Nothing here changes a design: accepting records who
 * accepted which layers and hands the accepted stack back; the editor writes it into a version.
 */

/** The largest picture sent to a model. Anthropic accepts 5 MB an image. */
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

export type Rejection = { readonly kind: "rejection"; readonly reason: string; readonly id?: string };

export interface StartDeps {
  readonly store: ImportStore;
  /** The owner's switch (open item P12). Off until the owner turns it on. */
  readonly enabled: boolean;
  /** The vision model, or null when none is configured. */
  readonly provider: TextModelProvider | null;
  readonly templates: TemplateSource;
  /** The image-model clean-up, or null when none is configured. */
  readonly cleanup: ImageCleanup | null;
  readonly projectInBrand: (projectId: string) => Promise<boolean>;
  readonly readFile: (fileId: string, maxBytes: number) => Promise<StoredBytes | typeof TOO_LARGE | null>;
  readonly usage: RouteUsage | null;
  /** What a budget cost, in microdollars. */
  readonly priceOf: (budget: Budget) => number;
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs: number;
}

const isModelType = (type: string): type is ModelImageType => (MODEL_IMAGE_TYPES as readonly string[]).includes(type);

async function refused(deps: StartDeps, reason: string): Promise<Rejection> {
  await deps.usage?.refund();
  return { kind: "rejection", reason };
}

/** Reads one picture into a proposal. Nothing is saved to a design. */
export async function startImport(
  deps: StartDeps,
  who: Who,
  input: { readonly projectId: string; readonly fileId: string; readonly size: string },
): Promise<{ readonly kind: "ready"; readonly record: ImportRecord } | Rejection> {
  if (!deps.enabled || !deps.provider) return refused(deps, SWITCHED_OFF);
  if (!(await deps.projectInBrand(input.projectId))) return refused(deps, PICTURE_NOT_FOUND);
  const file = await deps.readFile(input.fileId, PICTURE_MAX_BYTES);
  if (file === null) return refused(deps, PICTURE_NOT_FOUND);
  if (file === TOO_LARGE) return refused(deps, PICTURE_TOO_LARGE);
  if (!isModelType(file.contentType)) return refused(deps, PICTURE_NOT_OPENED);
  const decoded = await decodeForAnalysis(file.bytes);
  if (!decoded.ok) return refused(deps, PICTURE_NOT_OPENED);

  const id = await deps.store.create(who, { projectId: input.projectId, fileId: input.fileId });
  try {
    const outcome = await importFromPicture({
      raster: decoded.raster,
      image: { mediaType: file.contentType, base64: Buffer.from(file.bytes).toString("base64") },
      provider: deps.provider,
      templates: deps.templates,
      size: input.size,
      cleanup: deps.cleanup ?? undefined,
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    await deps.store.finish(who, id, {
      report: outcome.report,
      stack: outcome.stack,
      stored: outcome.stored,
      visionCalls: outcome.budget.visionCalls,
      imageEdits: outcome.budget.imageEdits,
      costMicrodollars: deps.priceOf(outcome.budget),
      error: outcome.report.warnings[0],
    });
  } catch (error) {
    deps.log({ level: "error", message: "A picture could not be read into a design", where: "design import", error });
    await deps.store.fail(who, id, READ_FAILED, 0);
    await deps.usage?.refund();
    return { kind: "rejection", reason: READ_FAILED, id };
  }
  const record = await deps.store.get(who.brandId, id);
  if (record === null) return { kind: "rejection", reason: READ_FAILED, id };
  if (record.status === "failed") return { kind: "rejection", reason: record.error ?? READ_FAILED, id };
  return { kind: "ready", record };
}

/** One reading, for the side-by-side screen. Null when it is not this brand's. */
export const loadImport = (store: ImportStore, brandId: string, id: string): Promise<ImportRecord | null> => store.get(brandId, id);

const replaceItem = (report: ImportReport, next: ImportReport["items"][number]): ImportReport => ({
  ...report,
  items: report.items.some((entry) => entry.id === next.id) ? report.items.map((entry) => (entry.id === next.id ? next : entry)) : [...report.items, next],
});

/** Redoes one view's fit after landmarks were dragged. The picture is not read again and no model is called. */
export async function refitImport(
  store: ImportStore,
  templates: TemplateSource,
  brandId: string,
  id: string,
  input: { readonly view: ViewId; readonly edits: readonly LandmarkHint[] },
): Promise<{ readonly kind: "refit"; readonly record: ImportRecord } | Rejection> {
  const record = await store.get(brandId, id);
  if (record === null) return { kind: "rejection", reason: IMPORT_NOT_FOUND };
  if (record.status !== "ready" || record.stored === null || record.report === null) return { kind: "rejection", reason: IMPORT_NOT_READY };
  const next = refitView(record.stored, input.view, input.edits, templates);
  if (next === null) return { kind: "rejection", reason: "That view is not in this reading." };
  const saved = await store.saveRefit(brandId, id, next.stored, replaceItem(record.report, next.item));
  if (!saved) return { kind: "rejection", reason: IMPORT_CLOSED };
  const fresh = await store.get(brandId, id);
  return fresh === null ? { kind: "rejection", reason: IMPORT_NOT_FOUND } : { kind: "refit", record: fresh };
}

export type AcceptResult =
  | { readonly kind: "accepted"; readonly stack: ArtworkStack; readonly layerIds: readonly string[] }
  | Rejection;

/**
 * Records that a person accepted a reading, all of it or some layers, and hands back the accepted stack.
 * Accepting does not write a design version: the editor does that from this stack (decision 0038).
 */
export async function acceptImport(store: ImportStore, who: Who, id: string, layerIds?: readonly string[]): Promise<AcceptResult> {
  const record = await store.get(who.brandId, id);
  if (record === null) return { kind: "rejection", reason: IMPORT_NOT_FOUND };
  if (record.status === "accepted" || record.status === "discarded") return { kind: "rejection", reason: IMPORT_CLOSED };
  if (record.status !== "ready" || record.stack === null) return { kind: "rejection", reason: IMPORT_NOT_READY };
  const known = record.stack.layers.map((layer) => layer.id);
  const chosen = layerIds ?? known;
  if (chosen.length === 0) return { kind: "rejection", reason: "Choose at least one layer to accept." };
  if (chosen.some((layer) => !known.includes(layer))) return { kind: "rejection", reason: "One of those layers is not in this reading." };
  const kept = parseArtworkStack({ ...record.stack, layers: record.stack.layers.filter((layer) => chosen.includes(layer.id)) });
  if (!kept.ok) return { kind: "rejection", reason: kept.reason };
  if (!(await store.accept(who, id, chosen))) return { kind: "rejection", reason: IMPORT_CLOSED };
  return { kind: "accepted", stack: kept.stack, layerIds: chosen };
}

/** Throws a proposal away. Its row stays, so the cost of the reading stays on record. */
export async function discardImport(store: ImportStore, brandId: string, id: string): Promise<{ readonly kind: "discarded" } | Rejection> {
  const record = await store.get(brandId, id);
  if (record === null) return { kind: "rejection", reason: IMPORT_NOT_FOUND };
  return (await store.discard(brandId, id)) ? { kind: "discarded" } : { kind: "rejection", reason: IMPORT_CLOSED };
}
