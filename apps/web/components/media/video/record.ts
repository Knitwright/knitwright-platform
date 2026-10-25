/*
 * Records a canvas to a video in the browser. No imports on purpose: the end-to-end test compiles this file and runs it in a
 * real Chromium. The numbers come from lib/media/video/limits.ts and are passed in.
 */

export type RecordOptions = Readonly<{
  /** Length of the recording. */
  seconds: number;
  /** Seconds for one full turn of the model. */
  revolutionSeconds: number;
  /** Largest file kept. */
  maxBytes: number;
  /** In order of preference. The first the browser can record is used. */
  mimeTypes: readonly string[];
  bitsPerSecond: number;
  /** The name of the event the viewer listens for. */
  turnEvent: string;
}>;

export type Recording = Readonly<{ video: Blob; poster: Blob }>;
export type RecordResult = { ok: true; recording: Recording } | { ok: false; reason: "unsupported" | "failed" | "too_large" };

export type RecorderEnv = Readonly<{
  MediaRecorder?: { new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder; isTypeSupported(type: string): boolean } | undefined;
  wait?: (ms: number) => Promise<void>;
}>;

const posterOf = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

const turn = (canvas: HTMLCanvasElement, name: string, revolutionSeconds: number | null): void => {
  canvas.dispatchEvent(new CustomEvent(name, { detail: { revolutionSeconds } }));
};

export async function recordCanvas(canvas: HTMLCanvasElement, options: RecordOptions, env: RecorderEnv = { MediaRecorder: typeof MediaRecorder === "undefined" ? undefined : MediaRecorder }): Promise<RecordResult> {
  const Recorder = env.MediaRecorder;
  const mimeType = Recorder ? options.mimeTypes.find((type) => Recorder.isTypeSupported(type)) : undefined;
  if (!Recorder || !mimeType || typeof canvas.captureStream !== "function") return { ok: false, reason: "unsupported" };
  const wait = env.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const stream = canvas.captureStream(30);
  try {
    const poster = await posterOf(canvas);
    if (!poster) return { ok: false, reason: "failed" };
    const recorder = new Recorder(stream, { mimeType, videoBitsPerSecond: options.bitsPerSecond });
    const chunks: Blob[] = [];
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("recorder"));
    });
    turn(canvas, options.turnEvent, options.revolutionSeconds);
    recorder.start(250);
    await wait(options.seconds * 1000);
    recorder.stop();
    await stopped;
    const video = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (video.size === 0) return { ok: false, reason: "failed" };
    return video.size > options.maxBytes ? { ok: false, reason: "too_large" } : { ok: true, recording: { video, poster } };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    turn(canvas, options.turnEvent, null);
    for (const track of stream.getTracks()) track.stop();
  }
}
