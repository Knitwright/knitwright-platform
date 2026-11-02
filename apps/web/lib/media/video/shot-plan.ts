import { frameCount, VIDEO_FPS, VIDEO_GAP_RULE, videoFormat, type VideoAspect, type VideoFormat } from "./formats";
import type { CameraMove, Colourway, SequenceKey, ShotSubject, VideoSequence } from "./sequences";

/**
 * A sequence and an aspect turned into a timeline: the one deterministic description of a video.
 *
 * Everything that draws reads this and nothing else, which is what makes a deterministic video
 * deterministic: the same design, sequence, aspect and text always give the same plan, so the same
 * video. The recorder in the browser plays the plan against the 3D view; a server-side encoder would
 * be handed the same plan (`encoder.ts`). **No unit test renders a video**: a test asserts the plan,
 * or the command built from it.
 *
 * The plan also says which moments the picture checker samples (`sampleMs`). A clip is a sequence of
 * pictures, so checking only the first frame would let a garment drift half way through and pass; the
 * sample times are spread across the whole length (spec F-L3: "the checker samples frames").
 */

export type TextRole = "headline" | "subhead" | "chip";

/** Text burned into the picture (spec F-L3 social frames: "Export as MP4 with the text burned in"). */
export interface TextOverlay {
  readonly id: string;
  readonly text: string;
  readonly fromMs: number;
  readonly toMs: number;
  /** Where the text sits, as a share of the width and the height, so one slot fits every aspect. */
  readonly xPercent: number;
  readonly yPercent: number;
  readonly align: "left" | "centre" | "right";
  /** The height of the type as a share of the video's height. */
  readonly sizePercent: number;
  readonly role: TextRole;
}

export interface PlannedShot {
  readonly shotId: string;
  readonly label: string;
  readonly fromMs: number;
  readonly toMs: number;
  readonly camera: CameraMove;
  readonly subject: ShotSubject;
  readonly colourway: Colourway;
}

export interface RenderPlan {
  readonly sequenceKey: SequenceKey;
  readonly format: VideoFormat;
  readonly fps: number;
  readonly durationMs: number;
  readonly frames: number;
  readonly shots: readonly PlannedShot[];
  readonly overlays: readonly TextOverlay[];
  /** The moments, in milliseconds, the checker takes a frame at. */
  readonly sampleMs: readonly number[];
  readonly ruleId: string;
}

export interface PlanInput {
  readonly sequence: VideoSequence;
  readonly aspect: VideoAspect;
  readonly overlays?: readonly TextOverlay[];
  /** How many frames the checker samples. A platform setting (`model-settings.ts`), never a literal. */
  readonly sampleFrames?: number;
  readonly fps?: number;
}

/** Where a sequence's shots fall on the timeline, in order, with no gap between them. */
function placeShots(sequence: VideoSequence): readonly PlannedShot[] {
  let at = 0;
  return sequence.shots.map((shot) => {
    const fromMs = at;
    at += Math.round(shot.seconds * 1000);
    return { shotId: shot.id, label: shot.label, fromMs, toMs: at, camera: shot.camera, subject: shot.subject, colourway: shot.colourway };
  });
}

/**
 * The moments to sample, spread evenly from the first frame to the last. One sample is the first
 * frame; two are the first and the last; more are evenly spaced between them.
 */
export function sampleTimes(durationMs: number, count: number, fps: number = VIDEO_FPS): readonly number[] {
  const frameMs = 1000 / Math.max(1, fps);
  const last = Math.max(0, durationMs - frameMs);
  const wanted = Math.max(1, Math.floor(count));
  if (wanted === 1) return [0];
  const step = last / (wanted - 1);
  return Array.from({ length: wanted }, (_, index) => Math.round(index * step));
}

/** The plan for this sequence at this aspect, with this text burned in. Pure, and the same every time. */
export function buildRenderPlan(input: PlanInput): RenderPlan {
  const fps = input.fps ?? VIDEO_FPS;
  const shots = placeShots(input.sequence);
  const durationMs = shots.length === 0 ? 0 : (shots[shots.length - 1] as PlannedShot).toMs;
  return {
    sequenceKey: input.sequence.key,
    format: videoFormat(input.aspect),
    fps,
    durationMs,
    frames: frameCount(durationMs / 1000, fps),
    shots,
    overlays: input.overlays ?? [],
    sampleMs: sampleTimes(durationMs, input.sampleFrames ?? 1, fps),
    ruleId: input.sequence.ruleId,
  };
}

/** The shot on screen at this moment, or null before the start and after the end. */
export function shotAt(plan: RenderPlan, ms: number): PlannedShot | null {
  if (ms < 0 || ms >= plan.durationMs) return null;
  return plan.shots.find((shot) => ms >= shot.fromMs && ms < shot.toMs) ?? null;
}

/** Where the camera is at this moment: the angle in degrees and how close it is. */
export interface CameraAt {
  readonly degrees: number;
  readonly zoom: number;
  readonly subject: ShotSubject;
  readonly colourway: Colourway;
}

const between = (from: number, to: number, part: number): number => from + (to - from) * part;

/**
 * The camera at this moment, worked out from the shot's own move. Straight interpolation on purpose:
 * an eased move would be a judgement about the look, and nobody has made one.
 */
export function cameraAt(plan: RenderPlan, ms: number): CameraAt | null {
  const shot = shotAt(plan, ms);
  if (!shot) return null;
  const span = Math.max(1, shot.toMs - shot.fromMs);
  const part = Math.min(1, Math.max(0, (ms - shot.fromMs) / span));
  const common = { subject: shot.subject, colourway: shot.colourway };
  if (shot.camera.kind === "orbit") return { ...common, degrees: between(shot.camera.fromDegrees, shot.camera.toDegrees, part), zoom: 1 };
  if (shot.camera.kind === "hold") return { ...common, degrees: shot.camera.atDegrees, zoom: 1 };
  return { ...common, degrees: shot.camera.atDegrees, zoom: between(shot.camera.fromZoom, shot.camera.toZoom, part) };
}

export interface PlanProgress {
  /** 0 to 1 across the whole video. */
  readonly part: number;
  /** The words for the stage on screen, so waiting says which part is being recorded. */
  readonly label: string;
  readonly shotIndex: number;
  readonly shotCount: number;
}

/** Honest progress: which shot is being recorded, and how far through the whole video it is. */
export function planProgress(plan: RenderPlan, ms: number): PlanProgress {
  const clamped = Math.min(Math.max(0, ms), plan.durationMs);
  const index = plan.shots.findIndex((shot) => clamped >= shot.fromMs && clamped < shot.toMs);
  const shotIndex = index === -1 ? Math.max(0, plan.shots.length - 1) : index;
  return {
    part: plan.durationMs === 0 ? 1 : clamped / plan.durationMs,
    label: plan.shots[shotIndex]?.label ?? "Recording",
    shotIndex,
    shotCount: plan.shots.length,
  };
}

/** The overlays showing at this moment, in the order they were given. */
export const overlaysAt = (plan: RenderPlan, ms: number): readonly TextOverlay[] =>
  plan.overlays.filter((overlay) => ms >= overlay.fromMs && ms < overlay.toMs);

/** Whole pixels for an overlay on this plan's canvas. */
export function overlayBox(plan: RenderPlan, overlay: TextOverlay): Readonly<{ x: number; y: number; size: number }> {
  return {
    x: Math.round((overlay.xPercent / 100) * plan.format.width),
    y: Math.round((overlay.yPercent / 100) * plan.format.height),
    size: Math.max(1, Math.round((overlay.sizePercent / 100) * plan.format.height)),
  };
}

export const PLAN_RULE = VIDEO_GAP_RULE;
