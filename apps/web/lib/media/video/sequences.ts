import { VIDEO_GAP_RULE } from "./formats";
import { TURNTABLE_SECONDS } from "./limits";

/**
 * The four free deterministic videos of the spec's Video studio (F-L3), as rows.
 *
 *   * 360 degree turntable, 6 s;
 *   * front-to-back flip, 4 s;
 *   * kit reveal: fabric close-up, then the shirt, then the crest, 8 s;
 *   * home / away / GK carousel, 9 s.
 *
 * Each is a list of **shots**, and a shot says what the camera does and which colourway is on screen.
 * Nothing here draws anything: `shot-plan.ts` turns a sequence and an aspect into a timeline, and the
 * recorder or the encoder plays that timeline against the 3D view. That is what makes these videos
 * deterministic -- the same design, sequence and aspect always give the same timeline -- and it is
 * also what keeps the garment locked, because every frame is the render the platform drew (spec
 * decision 13).
 *
 * A sequence also says what it **needs of the view** (`needs`). The 3D viewers answer one event
 * today (`knitwright:turn`, decision 0058), which is enough to turn the garment but not to point the
 * camera at a crest or to swap a colourway. A sequence whose needs the view does not answer is not
 * offered, and the panel says plainly why, rather than recording something that is not the video the
 * person asked for.
 */

/** What a sequence needs the 3D view to be able to do. The view answers with the ones it has. */
export const VIEW_CAPABILITIES = ["turn", "camera", "colourway"] as const;
export type ViewCapability = (typeof VIEW_CAPABILITIES)[number];

/** Which kit is on screen for a shot. The three the spec's carousel names. */
export const COLOURWAYS = ["home", "away", "gk"] as const;
export type Colourway = (typeof COLOURWAYS)[number];

export const COLOURWAY_LABELS: Readonly<Record<Colourway, string>> = { home: "Home", away: "Away", gk: "Goalkeeper" };

/** What the camera does during a shot. `orbit` turns the garment; the others move the camera itself. */
export type CameraMove =
  | Readonly<{ kind: "orbit"; fromDegrees: number; toDegrees: number }>
  | Readonly<{ kind: "hold"; atDegrees: number }>
  | Readonly<{ kind: "push_in"; atDegrees: number; fromZoom: number; toZoom: number }>;

/** What the camera is pointed at. A close-up of the fabric or the crest is a shot of its own in the kit reveal. */
export const SHOT_SUBJECTS = ["garment", "fabric", "crest"] as const;
export type ShotSubject = (typeof SHOT_SUBJECTS)[number];

export interface VideoShot {
  readonly id: string;
  /** The words shown against this part of the progress bar, so waiting says what is happening. */
  readonly label: string;
  readonly seconds: number;
  readonly camera: CameraMove;
  readonly subject: ShotSubject;
  readonly colourway: Colourway;
}

export const SEQUENCE_KEYS = ["turntable", "flip", "kit_reveal", "carousel"] as const;
export type SequenceKey = (typeof SEQUENCE_KEYS)[number];

export interface VideoSequence {
  readonly key: SequenceKey;
  readonly label: string;
  /** One sentence for the card and for the empty state. */
  readonly lead: string;
  /** The length the spec gives. `shot-plan.ts` checks the shots add up to it. */
  readonly seconds: number;
  readonly shots: readonly VideoShot[];
  readonly needs: readonly ViewCapability[];
  readonly ruleId: string;
  readonly note: string;
}

const SPEC_NOTE = "Length from the spec's Video studio (F-L3) and video templates (07)";

const shot = (
  id: string,
  label: string,
  seconds: number,
  camera: CameraMove,
  subject: ShotSubject = "garment",
  colourway: Colourway = "home",
): VideoShot => ({ id, label, seconds, camera, subject, colourway });

export const VIDEO_SEQUENCES: Readonly<Record<SequenceKey, VideoSequence>> = {
  turntable: {
    key: "turntable",
    label: "360° kit turntable",
    lead: "The garment turns once on the spot, so every side of the kit is on screen.",
    // The one length of one full turn, shared with the browser recording (`limits.ts`).
    seconds: TURNTABLE_SECONDS,
    shots: [shot("turn", "Turning the garment once", TURNTABLE_SECONDS, { kind: "orbit", fromDegrees: 0, toDegrees: 360 })],
    needs: ["turn"],
    ruleId: VIDEO_GAP_RULE,
    note: SPEC_NOTE,
  },
  flip: {
    key: "flip",
    label: "Front-to-back flip",
    lead: "A half turn from the front of the kit to the back, for the number and the name.",
    seconds: 4,
    shots: [shot("flip", "Turning from the front to the back", 4, { kind: "orbit", fromDegrees: 0, toDegrees: 180 })],
    needs: ["camera"],
    ruleId: VIDEO_GAP_RULE,
    note: SPEC_NOTE,
  },
  kit_reveal: {
    key: "kit_reveal",
    label: "Kit reveal",
    lead: "Close on the fabric, out to the whole shirt, then in on the crest.",
    seconds: 8,
    shots: [
      shot("fabric", "Close on the fabric", 3, { kind: "push_in", atDegrees: 0, fromZoom: 2.4, toZoom: 1.6 }, "fabric"),
      shot("shirt", "Out to the whole shirt", 3, { kind: "hold", atDegrees: 0 }),
      shot("crest", "In on the crest", 2, { kind: "push_in", atDegrees: 0, fromZoom: 1, toZoom: 2.2 }, "crest"),
    ],
    needs: ["camera"],
    ruleId: VIDEO_GAP_RULE,
    note: SPEC_NOTE,
  },
  carousel: {
    key: "carousel",
    label: "Home / away / GK carousel",
    lead: "Three seconds on each kit, in the order a club announces them.",
    seconds: 9,
    shots: [
      shot("home", "Home kit", 3, { kind: "hold", atDegrees: 0 }, "garment", "home"),
      shot("away", "Away kit", 3, { kind: "hold", atDegrees: 0 }, "garment", "away"),
      shot("gk", "Goalkeeper kit", 3, { kind: "hold", atDegrees: 0 }, "garment", "gk"),
    ],
    needs: ["colourway"],
    ruleId: VIDEO_GAP_RULE,
    note: SPEC_NOTE,
  },
};

/** The sequences in the order the spec lists them. */
export const SEQUENCES: readonly VideoSequence[] = SEQUENCE_KEYS.map((key) => VIDEO_SEQUENCES[key]);

export const isSequenceKey = (value: unknown): value is SequenceKey => (SEQUENCE_KEYS as readonly unknown[]).includes(value);

export const videoSequence = (key: unknown): VideoSequence | null => (isSequenceKey(key) ? VIDEO_SEQUENCES[key] : null);

export type SequenceVerdict =
  | Readonly<{ offered: true }>
  | Readonly<{ offered: false; missing: readonly ViewCapability[]; reason: string; ruleId: string }>;

const CAPABILITY_WORDS: Readonly<Record<ViewCapability, string>> = {
  turn: "turn the garment",
  camera: "point the camera",
  colourway: "change the colour version",
};

const list = (words: readonly string[]): string =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1] as string}`;

/**
 * Whether this 3D view can record this sequence. A view that cannot is told in words what it is
 * missing: an honest "not yet" beats a recording that is not the video the person asked for.
 */
export function sequenceVerdict(sequence: VideoSequence, has: readonly ViewCapability[]): SequenceVerdict {
  const missing = sequence.needs.filter((need) => !has.includes(need));
  if (missing.length === 0) return { offered: true };
  return {
    offered: false,
    missing,
    reason: `This 3D view cannot ${list(missing.map((need) => CAPABILITY_WORDS[need]))} yet, so ${sequence.label} cannot be recorded from it.`,
    ruleId: sequence.ruleId,
  };
}
