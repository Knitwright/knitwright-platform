import sharp from "sharp";
import { REFERENCE_EDGE } from "@/lib/images/reference";
import { ProviderError } from "@/lib/providers/image-provider";
import { checkGeneration, type FindingCode, type Thresholds } from "@/lib/media-check";
import type { GeneratedMedia, GenerateRequest, GeneratorResult, MediaGenerator } from "../contract";
import { NO_DESIGN_MESSAGE } from "../studio-generator";
import type { StudioDesign } from "../studio";
import type { Budget } from "./budget";
import { labelAsAi } from "./label";
import type { LifestyleProvider } from "./provider";
import { buildReference, type LifestyleReference } from "./reference";
import { promptFor, SCENE_IDS, SCENE_VIEWS, type SceneId } from "./scenes";

/**
 * Lifestyle pictures (plan v4, W3-B, decision 0057): the garment is drawn from the design, a provider puts it in a scene
 * or on a person, and the checker (decision 0055) compares the result with the drawing. A picture that fails is tried once
 * more with another seed, then dropped; a dropped picture is never stored. Making these never fails the set: the studio
 * renders beside them stay.
 */

export const GENERATOR_NAME = "lifestyle";
export const ATTEMPTS = 2;

export type DropReason = "no_provider" | "daily_cap" | "allowance" | "provider_failed" | "rejected" | "check_failed";

export type SceneOutcome = Readonly<{
  scene: SceneId;
  provider: string | null;
  attempts: number;
  /** True when the first picture passed: the spec asks for at least 3 of 4 like that. */
  passedFirstTry: boolean;
  kept: boolean;
  dropped: DropReason | null;
  /** What the checker said about the pictures that were turned away, in order. */
  rejectedFor: readonly FindingCode[];
  costMicrodollars: number;
}>;

export type LifestyleReport = Readonly<{
  outcomes: readonly SceneOutcome[];
  total: number;
  kept: number;
  passedFirstTry: number;
}>;

export type LifestyleDeps = Readonly<{
  loadDesign: (design: GenerateRequest["design"]) => Promise<StudioDesign | null>;
  providers: readonly LifestyleProvider[];
  budget: Budget;
  /** A picture of a person for the try-on providers. Null when none is set up. */
  loadModelImage?: () => Promise<Uint8Array | null>;
  thresholds?: Partial<Thresholds>;
  onReport?: (report: LifestyleReport) => void;
}>;

/** A small stable number from text (FNV-1a), so a seed is the same for the same design and scene. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

export const seedFor = (design: GenerateRequest["design"], scene: SceneId, attempt: number): number =>
  (hash(`${design.projectId}:${design.version}:${scene}`) + attempt * 7919) % 2_147_483_647;

/** The picture on the reference's canvas, as a PNG, when it is the same shape. Anything else goes to the checker as it is. */
async function onCanvas(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const { width = 0, height = 0 } = await sharp(bytes).metadata();
    const same = width === REFERENCE_EDGE && height === REFERENCE_EDGE;
    const square = width > 0 && Math.abs(width / height - 1) <= 0.02;
    if (same || !square) return bytes;
    return new Uint8Array(await sharp(bytes).resize(REFERENCE_EDGE, REFERENCE_EDGE, { fit: "fill" }).png().toBuffer());
  } catch {
    return bytes;
  }
}

type Scene = Readonly<{
  deps: LifestyleDeps;
  design: GenerateRequest["design"];
  reference: LifestyleReference;
  modelImage: Uint8Array | null;
  provider: LifestyleProvider;
  scene: SceneId;
  signal: AbortSignal;
}>;

type Made = { media: GeneratedMedia | null; outcome: SceneOutcome };

async function makeScene(s: Scene): Promise<Made> {
  const rejectedFor: FindingCode[] = [];
  let cost = 0;
  let attempts = 0;
  let dropped: DropReason = "rejected";
  const done = (media: GeneratedMedia | null): Made => ({
    media,
    outcome: {
      scene: s.scene,
      provider: s.provider.name,
      attempts,
      passedFirstTry: media !== null && attempts === 1,
      kept: media !== null,
      dropped: media ? null : dropped,
      rejectedFor,
      costMicrodollars: cost,
    },
  });
  for (let attempt = 0; attempt < ATTEMPTS && !s.signal.aborted; attempt++) {
    const spend = await s.deps.budget.take(s.provider.name, s.provider.costMicrodollars);
    if (!spend.ok) {
      dropped = spend.reason;
      break;
    }
    attempts++;
    let raw: Uint8Array;
    try {
      raw = await s.provider.generate(
        { scene: s.scene, prompt: promptFor(s.scene), seed: seedFor(s.design, s.scene, attempt), reference: s.reference.opaque, garment: s.reference.garment, modelImage: s.modelImage },
        s.signal,
      );
    } catch (error) {
      await spend.refund();
      dropped = "provider_failed";
      if (error instanceof ProviderError && error.refused) break;
      continue;
    }
    cost += s.provider.costMicrodollars;
    const generated = await onCanvas(raw);
    let verdict;
    try {
      verdict = await checkGeneration({ reference: s.reference.garment, generated, protectedRegions: s.reference.regions, thresholds: s.deps.thresholds });
    } catch {
      dropped = "check_failed";
      continue;
    }
    if (verdict.verdict === "passed") {
      const { width = REFERENCE_EDGE, height = REFERENCE_EDGE } = await sharp(generated).metadata();
      const png = new Uint8Array(await sharp(generated).png({ compressionLevel: 9 }).toBuffer());
      return done({
        kind: "lifestyle",
        view: SCENE_VIEWS[s.scene],
        png: labelAsAi(png, { provider: s.provider.name, scene: s.scene }),
        width,
        height,
        checker: "passed",
        provider: s.provider.name,
        costMicrodollars: cost,
      });
    }
    dropped = "rejected";
    rejectedFor.push(...verdict.findings.map((finding) => finding.code));
  }
  return done(null);
}

const noProvider = (scene: SceneId): Made => ({
  media: null,
  outcome: { scene, provider: null, attempts: 0, passedFirstTry: false, kept: false, dropped: "no_provider", rejectedFor: [], costMicrodollars: 0 },
});

export const reportOf = (outcomes: readonly SceneOutcome[]): LifestyleReport => ({
  outcomes,
  total: outcomes.length,
  kept: outcomes.filter((outcome) => outcome.kept).length,
  passedFirstTry: outcomes.filter((outcome) => outcome.passedFirstTry).length,
});

export const lifestyleGenerator = (deps: LifestyleDeps): MediaGenerator => ({
  name: GENERATOR_NAME,
  async generate(request, signal): Promise<GeneratorResult> {
    const design = await deps.loadDesign(request.design);
    if (!design) return { ok: false, message: NO_DESIGN_MESSAGE };
    const reference = await buildReference(design);
    const modelImage = (await deps.loadModelImage?.()) ?? null;
    const made = await Promise.all(
      SCENE_IDS.map((scene) => {
        const provider = deps.providers.find((candidate) => candidate.scenes.includes(scene) && (modelImage !== null || !candidate.needsModelImage));
        return provider ? makeScene({ deps, design: request.design, reference, modelImage, provider, scene, signal }) : noProvider(scene);
      }),
    );
    const report = reportOf(made.map((entry) => entry.outcome));
    deps.onReport?.(report);
    return { ok: true, media: made.flatMap((entry) => (entry.media ? [entry.media] : [])) };
  },
});
