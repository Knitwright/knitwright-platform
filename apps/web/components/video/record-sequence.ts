/*
 * Plays a deterministic video plan against the 3D view and records it in the browser.
 *
 * No imports on purpose, as `components/media/video/record.ts` has it (decision 0058): the end-to-end
 * test compiles this file and runs it in a real Chromium. The plan, its shots and the capability
 * names come in as plain values, and `record-sequence.test.ts` checks the names here against
 * `lib/media/video/sequences.ts` so the two cannot drift apart.
 *
 * THE VIEW ANSWERS FOR ITSELF. The 3D viewers answer one event today (`knitwright:turn`), which turns
 * the garment. Pointing the camera at a crest and swapping a colourway are two more events, and a
 * viewer that does not answer them cannot record a flip, a kit reveal or a carousel. So the recorder
 * **asks first**: it dispatches `knitwright:video-capabilities` with a reply function in its detail,
 * and whatever the view puts there is what it can do. A view that does not answer can only turn, and
 * the panel says so instead of recording something that is not the video the person asked for.
 */

export const VIDEO_EVENTS = {
  turn: "knitwright:turn",
  camera: "knitwright:camera",
  colourway: "knitwright:colourway",
  capabilities: "knitwright:video-capabilities",
} as const;

export type ViewAbility = "turn" | "camera" | "colourway";

type ShotLike = Readonly<{
  shotId: string;
  fromMs: number;
  toMs: number;
  camera: Readonly<{ kind: "orbit"; fromDegrees: number; toDegrees: number }> | Readonly<{ kind: "hold"; atDegrees: number }> | Readonly<{ kind: "push_in"; atDegrees: number; fromZoom: number; toZoom: number }>;
  subject: "garment" | "fabric" | "crest";
  colourway: "home" | "away" | "gk";
}>;

export type PlanLike = Readonly<{ durationMs: number; shots: readonly ShotLike[] }>;

/** One thing to do to the view at one moment. Pure output, so the timeline is tested on its own. */
export type ShotCommand = Readonly<{ atMs: number; event: string; detail: Readonly<Record<string, unknown>> }>;

/** The commands a plan sends to the view, in time order. A hold sends a camera command and no turn. */
export function shotCommands(plan: PlanLike): readonly ShotCommand[] {
  const out: ShotCommand[] = [];
  let lastColourway: string | null = null;
  for (const shot of plan.shots) {
    if (shot.colourway !== lastColourway) {
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.colourway, detail: { colourway: shot.colourway } });
      lastColourway = shot.colourway;
    }
    const seconds = (shot.toMs - shot.fromMs) / 1000;
    if (shot.camera.kind === "orbit") {
      const turns = Math.abs(shot.camera.toDegrees - shot.camera.fromDegrees) / 360;
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.turn, detail: { revolutionSeconds: turns === 0 ? null : seconds / turns } });
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.camera, detail: { degrees: shot.camera.fromDegrees, zoom: 1, subject: shot.subject, seconds } });
    } else if (shot.camera.kind === "hold") {
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.turn, detail: { revolutionSeconds: null } });
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.camera, detail: { degrees: shot.camera.atDegrees, zoom: 1, subject: shot.subject, seconds } });
    } else {
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.turn, detail: { revolutionSeconds: null } });
      out.push({ atMs: shot.fromMs, event: VIDEO_EVENTS.camera, detail: { degrees: shot.camera.atDegrees, zoom: shot.camera.fromZoom, toZoom: shot.camera.toZoom, subject: shot.subject, seconds } });
    }
  }
  return out;
}

/**
 * The abilities a plan's commands need of the view, worked out from the commands themselves. A full
 * turn of the whole garment is the one thing every viewer has done since decision 0058; a shot held
 * at the front needs nothing of the view at all; anything else -- a part turn, a zoom, a close-up of
 * the fabric or the crest -- needs a camera the view can point. `record-sequence.test.ts` checks this
 * against each sequence's own `needs`, so a sequence cannot claim less than its shots ask for.
 */
export function abilitiesNeeded(plan: PlanLike): readonly ViewAbility[] {
  const needs = new Set<ViewAbility>();
  if (new Set(plan.shots.map((shot) => shot.colourway)).size > 1) needs.add("colourway");
  for (const shot of plan.shots) {
    const whole = shot.subject === "garment";
    if (shot.camera.kind === "orbit") {
      if (whole && Math.abs(shot.camera.toDegrees - shot.camera.fromDegrees) === 360) needs.add("turn");
      else needs.add("camera");
    } else if (shot.camera.kind === "push_in" || shot.camera.atDegrees !== 0 || !whole) {
      needs.add("camera");
    }
  }
  return [...needs];
}

type Dispatcher = Readonly<{ dispatchEvent(event: Event): boolean }>;

type Env = Readonly<{
  /** Overridden in a test; in a browser it is `setTimeout`. */
  wait?: (ms: number) => Promise<void>;
  /** Overridden in a test; in a browser it is `CustomEvent`. */
  event?: (name: string, detail: unknown) => Event;
}>;

const defaultEvent = (name: string, detail: unknown): Event => new CustomEvent(name, { detail });
const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * What this view can do. The view answers by calling `answer` in the event's detail, synchronously.
 * A view that answers nothing can turn and no more, which is what every viewer has done since
 * decision 0058.
 */
export function askAbilities(canvas: Dispatcher, env: Env = {}): readonly ViewAbility[] {
  const given: ViewAbility[] = [];
  const answer = (abilities: readonly ViewAbility[]): void => {
    for (const ability of abilities) if (!given.includes(ability)) given.push(ability);
  };
  canvas.dispatchEvent((env.event ?? defaultEvent)(VIDEO_EVENTS.capabilities, { answer }));
  return given.length > 0 ? given : ["turn"];
}

export type RecordOutcome =
  | Readonly<{ ok: true; video: Blob; mimeType: string }>
  | Readonly<{ ok: false; reason: "unsupported" | "failed" | "too_large" }>;

type Recordable = Dispatcher &
  Readonly<{
    captureStream?: (fps: number) => MediaStream;
  }>;

type RecorderEnv = Env &
  Readonly<{
    /** In a browser it is `MediaRecorder`. A test passes a fake. */
    MediaRecorder?: { new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder; isTypeSupported(type: string): boolean } | undefined;
  }>;

export type RecordPlanOptions = Readonly<{
  /** In order of preference: MP4 first, because the spec asks for MP4. */
  mimeTypes: readonly string[];
  bitsPerSecond: number;
  fps: number;
  maxBytes: number;
}>;

/**
 * Records the plan off the canvas. The same glue as `components/media/video/record.ts` (decision
 * 0058), with the plan's own shots driving the view instead of one turn.
 */
export async function recordPlan(canvas: Recordable, plan: PlanLike, options: RecordPlanOptions, env: RecorderEnv = {}): Promise<RecordOutcome> {
  const Recorder = env.MediaRecorder ?? (typeof MediaRecorder === "undefined" ? undefined : MediaRecorder);
  const mimeType = Recorder ? options.mimeTypes.find((type) => Recorder.isTypeSupported(type)) : undefined;
  if (!Recorder || !mimeType || typeof canvas.captureStream !== "function") return { ok: false, reason: "unsupported" };
  const stream = canvas.captureStream(options.fps);
  try {
    const recorder = new Recorder(stream, { mimeType, videoBitsPerSecond: options.bitsPerSecond });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("recorder"));
    });
    recorder.start(250);
    await playPlan(canvas, plan, env);
    recorder.stop();
    await stopped;
    const video = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (video.size === 0) return { ok: false, reason: "failed" };
    return video.size > options.maxBytes ? { ok: false, reason: "too_large" } : { ok: true, video, mimeType };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

/** Sends a plan's commands to the view on schedule. Stops the garment turning when it is done. */
export async function playPlan(canvas: Dispatcher, plan: PlanLike, env: Env = {}): Promise<void> {
  const wait = env.wait ?? defaultWait;
  const make = env.event ?? defaultEvent;
  const commands = shotCommands(plan);
  let at = 0;
  for (const command of commands) {
    if (command.atMs > at) {
      await wait(command.atMs - at);
      at = command.atMs;
    }
    canvas.dispatchEvent(make(command.event, command.detail));
  }
  if (plan.durationMs > at) await wait(plan.durationMs - at);
  canvas.dispatchEvent(make(VIDEO_EVENTS.turn, { revolutionSeconds: null }));
}
