import { AppError } from "@/lib/server/core/errors";
import { screenImageContent } from "./image";
import type { ModerationSettings } from "./settings";
import type { ModerationStore } from "./store";
import { screenTextContent, type TextContext } from "./text";
import { reason, verdictOf, type Reason, type Verdict } from "./types";
import type { VisionCheck } from "./vision";

/**
 * The four hook points of F-G1, as functions other code calls (plan v5 X8, task 4). Each screens, keeps the result in
 * `moderation_checks`, and answers with the verdict. A blocked upload is refused before anything is stored; the other hooks hand
 * the verdict back and the caller refuses (`refuseIfBlocked`).
 */
export type ModerationDeps = Readonly<{
  store: ModerationStore;
  vision: VisionCheck | null;
  settings: ModerationSettings;
  log?: (message: string, error: unknown) => void;
}>;

type Who = Readonly<{ brandId: string; userId: string | null }>;

/** The first blocking reason as a refusal a person reads, or nothing when the verdict does not block. */
export function refuseIfBlocked(verdict: Verdict, field = "file"): void {
  if (verdict.result !== "blocked") return;
  const first = verdict.reasons.find((r) => r.severity === "block")!;
  throw new AppError("invalid_input", first.message, { [field]: [first.message] });
}

export type UploadInput = Who &
  Readonly<{
    /** The file's label (from its name), screened as text. */
    label: string;
    /** The screen copy the upload made: the picture as a browser would see it. */
    image: Uint8Array;
    sourceSha256: string;
  }>;

/** Keeps the result against the stored asset once it has an id. Never throws: the upload is already stored. */
export type AfterStore = (assetId: string) => Promise<void>;

/**
 * Screens an upload before it is stored. Blocked: the result is kept with no asset and the upload is refused. Otherwise the
 * answer keeps the result against the new asset's id; a flagged asset waits in the ops review queue.
 */
export async function screenUpload(deps: ModerationDeps, input: UploadInput): Promise<AfterStore> {
  const marks = await deps.store.marks();
  const label = screenTextContent(input.label, "label", marks);
  const image = await screenImageContent({ bytes: input.image, marks, settings: deps.settings, vision: deps.vision });
  const verdict = verdictOf([...label.reasons, ...image.reasons]);
  const check = { brandId: input.brandId, userId: input.userId, targetKind: "asset" as const, hook: "upload" as const, label: input.label, subjectSha256: input.sourceSha256, verdict };
  if (verdict.result === "blocked") {
    await deps.store.record({ ...check, targetId: null });
    refuseIfBlocked(verdict);
  }
  return async (assetId) => {
    try {
      await deps.store.record({ ...check, targetId: assetId });
    } catch (error) {
      // The asset then has no check; screenBeforeOrder treats it as not screened and holds the order for a person.
      deps.log?.(`The moderation result of asset ${assetId} could not be kept.`, error);
    }
  };
}

export type TextInput = Who &
  Readonly<{ text: string; context: TextContext; targetKind?: "text" | "version"; targetId?: string | null }>;

/** Screens a title, a name, a slogan or a prompt, and keeps the result. */
export async function screenText(deps: ModerationDeps, input: TextInput): Promise<Verdict> {
  const verdict = screenTextContent(input.text, input.context, await deps.store.marks());
  await deps.store.record({
    brandId: input.brandId, userId: input.userId, targetKind: input.targetKind ?? "text", targetId: input.targetId ?? null,
    hook: "text", label: `${input.context}: ${input.text}`, subjectSha256: null, verdict,
  });
  return verdict;
}

export type GenerationInput = Who & Readonly<{ generationId: string; image: Uint8Array; prompt: string }>;

/** Screens an AI generation (picture and prompt) and keeps the result against it. */
export async function screenGeneration(deps: ModerationDeps, input: GenerationInput): Promise<Verdict> {
  const marks = await deps.store.marks();
  const prompt = screenTextContent(input.prompt, "prompt", marks);
  const image = await screenImageContent({ bytes: input.image, marks, settings: deps.settings, vision: deps.vision });
  const verdict = verdictOf([...prompt.reasons, ...image.reasons]);
  await deps.store.record({ brandId: input.brandId, userId: input.userId, targetKind: "generation", targetId: input.generationId, hook: "generation", label: input.prompt, subjectSha256: null, verdict });
  return verdict;
}

export type OrderInput = Who &
  Readonly<{
    /** The saved design version being ordered. */
    versionId: string;
    label: string;
    assetIds: readonly string[];
    texts: readonly Readonly<{ text: string; context: TextContext }>[];
    /** A Class B run needs a person to allow this version first (spec F-G1). */
    classB: boolean;
  }>;

async function assetReasons(store: ModerationStore, ids: readonly string[]): Promise<Reason[]> {
  const unique = [...new Set(ids)];
  const states = new Map((await store.latest("asset", unique)).map((s) => [s.targetId, s]));
  return unique.flatMap((id): Reason[] => {
    const state = states.get(id);
    if (!state) return [reason("not_screened", "flag", "A picture in this design was never screened. A person will look at it.", id)];
    if (state.decision === "blocked") return [reason("blocked_by_review", "block", "A picture in this design was blocked by our review. Remove it to order.", id)];
    if (state.decision === "allowed" || state.result === "clear") return [];
    if (state.result === "blocked") return [reason("blocked_by_review", "block", "A picture in this design was refused. Remove it to order.", id)];
    return [reason("awaiting_review", "flag", "A picture in this design is waiting for our review.", id)];
  });
}

/**
 * Screens a design version before an order: every picture's latest result, every text again, and for a Class B run a person's
 * decision. The result is kept against the version; a flagged version is in the ops queue, and allowing it there clears it.
 */
export async function screenBeforeOrder(deps: ModerationDeps, input: OrderInput): Promise<Verdict> {
  const marks = await deps.store.marks();
  const texts = input.texts.flatMap((t) => screenTextContent(t.text, t.context, marks).reasons);
  const assets = await assetReasons(deps.store, input.assetIds);
  const allowed = input.classB && (await deps.store.humanAllowed("version", input.versionId));
  const review = input.classB && !allowed ? [reason("human_review_required", "flag", "A run needs our review of the design before it starts.")] : [];
  const verdict = verdictOf([...texts, ...assets, ...review]);
  await deps.store.record({ brandId: input.brandId, userId: input.userId, targetKind: "version", targetId: input.versionId, hook: "order", label: input.label, subjectSha256: null, verdict });
  return verdict;
}

/**
 * The guard a Class B run calls before it starts (plan v5 X8, task 5): refuses unless a person allowed this design version and
 * nothing was flagged or blocked about it since.
 */
export async function assertHumanReviewed(store: ModerationStore, versionId: string): Promise<void> {
  if (!(await store.humanAllowed("version", versionId))) {
    throw new AppError("conflict", "This design needs our review before a run can start. It is in the review queue.");
  }
}
