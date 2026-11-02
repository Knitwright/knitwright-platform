/**
 * WHAT THE VIDEO STUDIO ASKS OF A 3D VIEW, AND HOW A VIEW ANSWERS (L5, decision 0095, item 3).
 *
 * `components/video/record-sequence.ts` plays a deterministic shot plan against the 3D view by
 * dispatching three events at it, and **asks first** what the view can do: it dispatches
 * `knitwright:video-capabilities` with a reply function, and a sequence whose needs the view does
 * not answer is shown disabled with the sentence that says why. Before this file nothing listened,
 * so every view could only turn and three of the four free videos were refused.
 *
 * The names and the numbers live here rather than in a scene file for two reasons: a scene file is
 * the one file that may import three.js, so nothing can test it; and `video-events.test.ts` holds
 * the event names to `record-sequence.ts`'s own, so the recorder and the views cannot drift apart.
 *
 * **Nothing here claims an ability the view does not have.** `listenForVideoEvents` answers with
 * exactly the handlers it was given, so a viewer that cannot swap a colourway says so and the
 * carousel stays disabled -- which is better than a recording that is not the video that was asked
 * for.
 */

/** The four events, exactly as `components/video/record-sequence.ts` dispatches them. */
export const VIEW_EVENTS = {
  turn: "knitwright:turn",
  camera: "knitwright:camera",
  colourway: "knitwright:colourway",
  capabilities: "knitwright:video-capabilities",
} as const;

export const VIEW_ABILITIES = ["turn", "camera", "colourway"] as const;
export type ViewAbility = (typeof VIEW_ABILITIES)[number];

/** What a shot points the camera at (`lib/media/video/sequences.ts`'s own three subjects). */
export const CAMERA_SUBJECTS = ["garment", "fabric", "crest"] as const;
export type CameraSubject = (typeof CAMERA_SUBJECTS)[number];

/** One camera move, as a shot asks for it. Degrees run from the front, clockwise. */
export interface CameraAsk {
  readonly degrees: number;
  /** 1 is the whole garment in frame; above 1 is closer. */
  readonly zoom: number;
  /** The zoom to end at, for a push in or out, or null to hold. */
  readonly toZoom: number | null;
  readonly subject: CameraSubject;
  readonly seconds: number;
}

const isSubject = (value: unknown): value is CameraSubject => (CAMERA_SUBJECTS as readonly unknown[]).includes(value);

/** A finite number in a value from outside this module, or the fallback. */
const number = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/**
 * A camera event's detail, read as what it is: a value from another module, through the DOM. A
 * detail that says nothing usable still gives a straight-on shot of the whole garment, because a
 * recording that stops half way is worse than one that holds still.
 */
export function cameraAsk(detail: unknown): CameraAsk {
  const row = (typeof detail === "object" && detail !== null ? detail : {}) as Record<string, unknown>;
  const zoom = Math.max(0.1, Math.min(8, number(row.zoom, 1)));
  const to = row.toZoom === undefined || row.toZoom === null ? null : Math.max(0.1, Math.min(8, number(row.toZoom, zoom)));
  return {
    degrees: number(row.degrees, 0),
    zoom,
    toZoom: to,
    subject: isSubject(row.subject) ? row.subject : "garment",
    seconds: Math.max(0, number(row.seconds, 0)),
  };
}

/** The colourway a colourway event names, or null for a detail that names none. */
export function colourwayAsked(detail: unknown): string | null {
  const row = (typeof detail === "object" && detail !== null ? detail : {}) as Record<string, unknown>;
  const value = row.colourway;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** The revolution a turn event asks for, in seconds, or null to stop turning (decision 0058). */
export function turnAsked(detail: unknown): number | null {
  const row = (typeof detail === "object" && detail !== null ? detail : {}) as Record<string, unknown>;
  const value = row.revolutionSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Where a shot's subject sits on the garment, as a share of its height above the middle.
 *
 * **Nobody has reviewed these two figures.** A crest sits where the design puts it and this
 * platform does not yet hold that place as data, so a close-up of "the crest" is a close-up of the
 * upper chest, which is where a crest is on every kit this platform draws. The fabric is the middle
 * of the garment, which needs no figure at all.
 */
export const SUBJECT_HEIGHT: Readonly<Record<CameraSubject, number>> = { garment: 0, fabric: 0, crest: 0.22 };

export const SUBJECT_HEIGHT_NOTE =
  "A close-up of the crest is framed on the upper chest, because where a design puts its crest is not held as data yet. Not reviewed by anyone.";

/** Where the camera looks for this subject, in the garment's own units from its middle. */
export const subjectHeight = (subject: CameraSubject, garmentHeight: number): number => SUBJECT_HEIGHT[subject] * garmentHeight;

/** How far the camera stands for a zoom, never outside the limits the view already keeps. */
export const distanceFor = (base: number, zoom: number, limits: Readonly<{ min: number; max: number }>): number =>
  Math.min(limits.max, Math.max(limits.min, base / Math.max(zoom, 0.1)));

/** What a view does when the recorder asks. Only `turn` is required: every viewer has turned since 0058. */
export interface ViewHandlers {
  readonly turn: (revolutionSeconds: number | null) => void;
  /** Points the camera. Left out by a view that cannot, and the flip and the kit reveal stay off. */
  readonly camera?: (ask: CameraAsk) => void;
  /** Shows another colour version. Left out by a view that holds one, and the carousel stays off. */
  readonly colourway?: (colourway: string) => void;
}

/** The abilities a set of handlers really answers for, in the order the recorder lists them. */
export const abilitiesOf = (handlers: ViewHandlers): readonly ViewAbility[] =>
  VIEW_ABILITIES.filter((ability) => (ability === "turn" ? true : handlers[ability] !== undefined));

type Detailed = Readonly<{ detail?: unknown }>;

/**
 * Listens for the recorder's events on a 3D view's canvas, and answers the capabilities question
 * with the abilities the handlers really have. Returns the function that takes the listeners off
 * again, which a scene calls when it is disposed.
 */
export function listenForVideoEvents(target: EventTarget, handlers: ViewHandlers): () => void {
  const abilities = abilitiesOf(handlers);
  const onTurn = (event: Event): void => handlers.turn(turnAsked((event as Detailed).detail));
  const onCamera = (event: Event): void => handlers.camera?.(cameraAsk((event as Detailed).detail));
  const onColourway = (event: Event): void => {
    const asked = colourwayAsked((event as Detailed).detail);
    if (asked !== null) handlers.colourway?.(asked);
  };
  const onAsked = (event: Event): void => {
    const detail = (event as Detailed).detail;
    const answer = (typeof detail === "object" && detail !== null ? (detail as { answer?: unknown }).answer : undefined);
    if (typeof answer === "function") (answer as (given: readonly ViewAbility[]) => void)(abilities);
  };

  target.addEventListener(VIEW_EVENTS.turn, onTurn);
  target.addEventListener(VIEW_EVENTS.capabilities, onAsked);
  if (handlers.camera) target.addEventListener(VIEW_EVENTS.camera, onCamera);
  if (handlers.colourway) target.addEventListener(VIEW_EVENTS.colourway, onColourway);

  return () => {
    target.removeEventListener(VIEW_EVENTS.turn, onTurn);
    target.removeEventListener(VIEW_EVENTS.capabilities, onAsked);
    target.removeEventListener(VIEW_EVENTS.camera, onCamera);
    target.removeEventListener(VIEW_EVENTS.colourway, onColourway);
  };
}
