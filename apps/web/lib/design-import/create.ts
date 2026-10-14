import type { SupabaseClient } from "@supabase/supabase-js";
import { INTAKE_LIMITS } from "@/lib/artwork-intake";
import type { Layer } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import type { StoredBytes } from "@/lib/storage/read";
import { TOO_LARGE } from "@/lib/storage/read";
import { spentMicrodollars } from "./cost";
import type { PricedProvider } from "@/lib/providers/select";
import { runImport, type PipelineDeps } from "./pipeline";
import { derivedIds, storeDerived, withNotes, type DerivedStore } from "./derived";
import { intakePicture } from "./intake";
import { assertUnderDailyCap, createImport, getImport, replaceProposal, type StoredImport } from "./service";
import { analysisView, type ImportView } from "./view-model";
import type { ViewLandmarks } from "./types";

/**
 * The work behind the routes, with every outside service passed in. Reading a picture reaches the providers, so a
 * failed or empty reading gives the reservation back. Nothing here makes the reading the person's design.
 */

export const NOT_FOUND = "That picture could not be found. Upload it again. Nothing was changed.";
export const TOO_LARGE_TO_READ = `That picture is too large to read. Use one under ${INTAKE_LIMITS.maxFileBytes / (1024 * 1024)} MB. Nothing was changed.`;
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
  /** Where the pictures cut for the proposal are stored as the person's artwork (W7b). */
  readonly store: (now: Date) => DerivedStore;
  readonly now?: Date;
}

async function refused(deps: Pick<CreateDeps, "usage">, reason: string): Promise<CreateResult> {
  await deps.usage?.refund();
  return { kind: "rejection", reason };
}

type Ready = Extract<Awaited<ReturnType<typeof runImport>>, { ok: true }>;

/** Stores what the proposal cut from the picture and points its layers at it, so the proposal holds real assets. */
async function withStoredPictures(outcome: Ready, store: DerivedStore): Promise<{ ready: Ready; ids: readonly string[] }> {
  const stored = await storeDerived(outcome.stack, outcome.pictures, outcome.cropFiles, store);
  return { ready: { ...outcome, stack: stored.stack, report: withNotes(outcome.report, stored.notes) }, ids: stored.ids };
}

/** A crest, sponsor or badge the person already replaced stays replaced when the fit is redone. */
function keepReplacements(before: readonly Layer[], after: Ready): Ready {
  const replaced = new Map(before.filter((l) => l.kind === "graphic" && l.provenance === "user-edited").map((l) => [l.id, l]));
  const layers = after.stack.layers.map((layer) => {
    const mine = replaced.get(layer.id);
    return mine?.kind === "graphic" && layer.kind === "graphic" ? { ...layer, source: mine.source, heightMm: mine.heightMm, provenance: mine.provenance } : layer;
  });
  return { ...after, stack: { ...after.stack, layers } };
}

async function intake(deps: Pick<CreateDeps, "readFile" | "log">, fileId: string) {
  const file = await deps.readFile(fileId, INTAKE_LIMITS.maxFileBytes);
  if (file === null) return { reason: NOT_FOUND };
  if (file === TOO_LARGE) return { reason: TOO_LARGE_TO_READ };
  try {
    return { picture: await intakePicture(file.bytes) };
  } catch (error) {
    if (error instanceof AppError) return { reason: `${error.message} Nothing was changed.` };
    deps.log({ level: "error", message: "A picture could not be taken in", where: "design import intake", error });
    return { reason: FAILED };
  }
}

export async function createFromFile(deps: CreateDeps, input: { readonly fileId: string }): Promise<CreateResult> {
  const now = deps.now ?? new Date();
  await assertUnderDailyCap(deps.admin, deps.who.brandId, now);
  const taken = await intake(deps, input.fileId);
  if (taken.picture === undefined) return refused(deps, taken.reason);
  const { picture } = taken;
  const pipeline = deps.pipeline(deps.usage);
  let outcome: Awaited<ReturnType<typeof runImport>>;
  try {
    outcome = await runImport({ bytes: picture.bytes, mediaType: picture.mediaType, notes: picture.notes, signal: AbortSignal.timeout(deps.timeoutMs) }, pipeline);
  } catch (error) {
    deps.log({ level: "error", message: "A picture could not be read into a design", where: "design import", error });
    return refused(deps, FAILED);
  }
  // A reading that was made and could not be used was still paid for, so only a request that made no call is given back.
  if (!outcome.ok) return outcome.spend.visionCalls > 0 || outcome.spend.imageEdits > 0 ? { kind: "rejection", reason: outcome.reason } : refused(deps, outcome.reason);
  const store = deps.store(now);
  const entry = deps.vision?.entry;
  let stored: Awaited<ReturnType<typeof withStoredPictures>>;
  try {
    stored = await withStoredPictures(outcome, store);
  } catch (error) {
    deps.log({ level: "error", message: "The pictures cut for a design could not be stored", where: "design import store", error });
    return { kind: "rejection", reason: FAILED };
  }
  let id: string;
  try {
    id = await createImport(deps.admin, deps.who, {
      sourceFileId: input.fileId,
      rightsAcceptedAt: now,
      outcome: stored.ready,
      costMicrodollars: entry ? spentMicrodollars(entry, outcome.report.spend) : 0,
    });
  } catch (error) {
    await store.remove(stored.ids);
    throw error;
  }
  return { kind: "ready", view: analysisView(await getImport(deps.client, deps.who.brandId, id)) };
}

/** Redoes the fit of a ready import with the landmarks the person moved. The stored reading is used: no vision call. */
export async function refitImport(deps: Omit<CreateDeps, "vision" | "usage" | "now">, importId: string, edits: ViewLandmarks): Promise<CreateResult> {
  const before: StoredImport = await getImport(deps.client, deps.who.brandId, importId);
  const taken = await intake(deps, before.sourceFileId);
  if (taken.picture === undefined) return { kind: "rejection", reason: taken.reason === FAILED ? FAILED : NOT_FOUND };
  const pipeline = deps.pipeline(null);
  let outcome: Awaited<ReturnType<typeof runImport>>;
  try {
    outcome = await runImport({ bytes: taken.picture.bytes, mediaType: taken.picture.mediaType, notes: taken.picture.notes, reading: before.reading, edits, signal: AbortSignal.timeout(deps.timeoutMs) }, pipeline);
  } catch (error) {
    deps.log({ level: "error", message: "A fit could not be redone", where: "design import refit", error });
    return { kind: "rejection", reason: FAILED };
  }
  if (!outcome.ok) return { kind: "rejection", reason: outcome.reason };
  const store = deps.store(new Date());
  let stored: Awaited<ReturnType<typeof withStoredPictures>>;
  try {
    stored = await withStoredPictures(outcome, store);
  } catch (error) {
    deps.log({ level: "error", message: "The pictures cut for a fit could not be stored", where: "design import refit store", error });
    return { kind: "rejection", reason: FAILED };
  }
  try {
    await replaceProposal(deps.admin, deps.who, importId, keepReplacements(before.stack.layers, stored.ready));
  } catch (error) {
    await store.remove(stored.ids);
    throw error;
  }
  await store.remove(derivedIds(before.stack.layers));
  return { kind: "ready", view: analysisView(await getImport(deps.client, deps.who.brandId, importId)) };
}
