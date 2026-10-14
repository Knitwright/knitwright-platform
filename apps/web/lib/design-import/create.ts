import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_IMAGE_TYPES, type ModelImageType } from "@/lib/providers/text-model";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import type { StoredBytes } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";
import { spentMicrodollars } from "./cost";
import type { PricedProvider } from "@/lib/providers/select";
import { runImport, type PipelineDeps } from "./pipeline";
import { assertUnderDailyCap, createImport, getImport, replaceProposal, type StoredImport } from "./service";
import { analysisView, type ImportView } from "./view-model";
import type { ViewLandmarks } from "./types";

/**
 * The work behind the routes, with every outside service passed in. Reading a picture reaches the providers, so a
 * failed or empty reading gives the reservation back. Nothing here makes the reading the person's design.
 */

export const VISION_MAX_BYTES = 5 * 1024 * 1024;
export const NOT_FOUND = "That picture could not be found. Upload it again. Nothing was changed.";
export const TOO_LARGE_TO_READ = `That picture is too large to read. Use one under ${VISION_MAX_BYTES / (1024 * 1024)} MB. Nothing was changed.`;
export const NOT_READABLE_TYPE = "That picture cannot be read. Upload a PNG, JPEG or WebP image. Nothing was changed.";
export const FAILED = "The picture could not be read just now. Nothing was changed. Try again in a moment.";

export type CreateResult =
  | { readonly kind: "ready"; readonly view: ImportView }
  | { readonly kind: "rejection"; readonly reason: string };

export interface CreateDeps {
  readonly client: SupabaseClient;
  readonly admin: SupabaseClient;
  readonly who: { readonly brandId: string; readonly userId: string };
  readonly vision: PricedProvider | null;
  readonly pipeline: (usage: RouteUsage | null) => PipelineDeps;
  readonly readFile: (fileId: string, maxBytes: number) => Promise<StoredBytes | typeof TOO_LARGE | null>;
  readonly usage: RouteUsage | null;
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs: number;
  readonly now?: Date;
}

const isModelType = (type: string): type is ModelImageType => (MODEL_IMAGE_TYPES as readonly string[]).includes(type);

async function refused(deps: Pick<CreateDeps, "usage">, reason: string): Promise<CreateResult> {
  await deps.usage?.refund();
  return { kind: "rejection", reason };
}

export async function createFromFile(deps: CreateDeps, input: { readonly fileId: string }): Promise<CreateResult> {
  const now = deps.now ?? new Date();
  await assertUnderDailyCap(deps.admin, deps.who.brandId, now);
  const file = await deps.readFile(input.fileId, VISION_MAX_BYTES);
  if (file === null) return refused(deps, NOT_FOUND);
  if (file === TOO_LARGE) return refused(deps, TOO_LARGE_TO_READ);
  if (!isModelType(file.contentType)) return refused(deps, NOT_READABLE_TYPE);
  const pipeline = deps.pipeline(deps.usage);
  let outcome: Awaited<ReturnType<typeof runImport>>;
  try {
    outcome = await runImport({ bytes: file.bytes, mediaType: file.contentType, signal: AbortSignal.timeout(deps.timeoutMs) }, pipeline);
  } catch (error) {
    deps.log({ level: "error", message: "A picture could not be read into a design", where: "design import", error });
    return refused(deps, FAILED);
  }
  if (!outcome.ok) return refused(deps, outcome.reason);
  const entry = deps.vision?.entry;
  const id = await createImport(deps.admin, deps.who, {
    sourceFileId: input.fileId,
    rightsAcceptedAt: now,
    outcome,
    costMicrodollars: entry ? spentMicrodollars(entry, outcome.report.spend) : 0,
  });
  return { kind: "ready", view: analysisView(await getImport(deps.client, deps.who.brandId, id)) };
}

/** Redoes the fit of a ready import with the landmarks the person moved. The stored reading is used: no vision call. */
export async function refitImport(deps: Omit<CreateDeps, "vision" | "usage" | "now">, importId: string, edits: ViewLandmarks): Promise<CreateResult> {
  const stored: StoredImport = await getImport(deps.client, deps.who.brandId, importId);
  const file = await deps.readFile(stored.sourceFileId, VISION_MAX_BYTES);
  if (file === null || file === TOO_LARGE || !isModelType(file.contentType)) return { kind: "rejection", reason: NOT_FOUND };
  const pipeline = deps.pipeline(null);
  let outcome: Awaited<ReturnType<typeof runImport>>;
  try {
    outcome = await runImport({ bytes: file.bytes, mediaType: file.contentType, reading: stored.reading, edits, signal: AbortSignal.timeout(deps.timeoutMs) }, pipeline);
  } catch (error) {
    deps.log({ level: "error", message: "A fit could not be redone", where: "design import refit", error });
    return { kind: "rejection", reason: FAILED };
  }
  if (!outcome.ok) return { kind: "rejection", reason: outcome.reason };
  await replaceProposal(deps.admin, deps.who, importId, outcome);
  return { kind: "ready", view: analysisView(await getImport(deps.client, deps.who.brandId, importId)) };
}
