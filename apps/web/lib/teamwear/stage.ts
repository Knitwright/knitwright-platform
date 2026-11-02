import { BACKDROP_LABELS, STAGE_VIEWS, STAGE_VIEW_LABELS, sportById, type BackdropId, type StageViewId } from "./vocabulary";

/**
 * The full-bleed 3D stage (spec F-T1): where the camera stands for each of the five views, which
 * backdrop the sport draws, and what a snapshot is called.
 *
 * The angles here are how the stage is framed, not measurements of a garment: nothing in this file
 * reaches a pattern, a print file or a tech pack. The distance each view wants is a multiple of the
 * distance that fits the whole garment, which `lib/garment3d/viewer` works out from the mesh.
 */

export interface CameraAngle {
  /** Round the upright axis, in degrees. Nought faces the front of the garment. */
  readonly azimuthDegrees: number;
  /** Down from the upright axis, in degrees. Ninety is level with the middle of the garment. */
  readonly polarDegrees: number;
  /** A multiple of the distance that fits the whole garment in frame. The collar view comes closer. */
  readonly distanceFactor: number;
}

const LEVEL = 90;

/** Where the camera stands for each view. Left and right are the viewer's, as a person reads a photograph. */
const ANGLES: Readonly<Record<StageViewId, CameraAngle>> = {
  front: { azimuthDegrees: 0, polarDegrees: LEVEL, distanceFactor: 1 },
  back: { azimuthDegrees: 180, polarDegrees: LEVEL, distanceFactor: 1 },
  left: { azimuthDegrees: -90, polarDegrees: LEVEL, distanceFactor: 1 },
  right: { azimuthDegrees: 90, polarDegrees: LEVEL, distanceFactor: 1 },
  collar: { azimuthDegrees: 0, polarDegrees: 50, distanceFactor: 0.6 },
};

export const cameraAngleFor = (view: StageViewId): CameraAngle => ANGLES[view];

/** The chips the view chip offers, with the one showing marked. */
export const viewChips = (showing: StageViewId): readonly Readonly<{ id: StageViewId; label: string; showing: boolean }>[] =>
  STAGE_VIEWS.map((id) => ({ id, label: STAGE_VIEW_LABELS[id], showing: id === showing }));

export const parseView = (value: string | readonly string[] | undefined): StageViewId => {
  const asked = Array.isArray(value) ? value[0] : value;
  return STAGE_VIEWS.find((view) => view === asked) ?? "front";
};

/** The backdrop a sport is shown against, and the words that describe it for a reader who cannot see it. */
export function backdropFor(sportId: string): Readonly<{ id: BackdropId; label: string }> {
  const id = sportById(sportId).backdrop;
  return { id, label: BACKDROP_LABELS[id] };
}

/** How long one turn of the turntable takes, in seconds. The 3D scene already takes this as a number. */
export const TURNTABLE_SECONDS = 12;

/** Nothing turns by itself for a person who has asked their device for less motion. */
export const turntableSecondsFor = (reducedMotion: boolean): number | null => (reducedMotion ? null : TURNTABLE_SECONDS);

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * What a snapshot is called: the sport, the view and the date, so a club can tell two WhatsApp
 * pictures apart. Deterministic, so a test can assert it.
 */
export function snapshotName(sportId: string, view: StageViewId, at: Date): string {
  const day = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
  return `knitwright-kit-${sportById(sportId).id}-${view}-${day}.png`;
}

/** Said beside the stage at all times, as the 3D view says elsewhere: it shows shape and colour, not fit. */
export const STAGE_NOTE = "A preview of shape and colour, not of fit or drape.";

/** Said where the browser cannot draw in 3D. The drawing of the kit is shown instead. */
export const STAGE_FAILED = "This browser could not draw the kit in 3D. The flat drawing below is the same design.";

/** Said where the garment has no drawing yet, so there is nothing to put on the stage. */
export const STAGE_NOT_DRAWN = "There is no drawing for this part yet, so it cannot be shown on the stage.";
