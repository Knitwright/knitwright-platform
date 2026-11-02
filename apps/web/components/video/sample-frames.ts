/*
 * Takes frames out of a finished clip, in the browser.
 *
 * No imports on purpose, like `record.ts` and `record-sequence.ts`: this file is compiled and run in
 * a real Chromium by the end-to-end test.
 *
 * WHY THE BROWSER. The picture checker has to see several frames of a clip, not just the first one
 * (spec F-L3). Reading frames out of an MP4 needs a decoder, and a Node function on the deploy target
 * has none -- that is the same reason the encoder is the browser recorder (decision 0095). A browser
 * has a decoder in every tab: a `<video>` element is seeked to each moment and drawn onto a canvas.
 * The PNGs go up with the clip, and the server runs `lib/media/video/frame-check.ts` on them.
 *
 * A frame that cannot be read is **left out**, never replaced with something else, because
 * `checkClipFrames` turns a clip away when fewer frames come back than were asked for. A clip whose
 * frames cannot be read is therefore not kept, and the credits for it are given back.
 */

export type SampledFrameBlob = Readonly<{ atMs: number; png: Blob }>;

interface SampleVideo {
  currentTime: number;
  readonly videoWidth: number;
  readonly videoHeight: number;
  src: string;
  muted: boolean;
  preload: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  load(): void;
}

interface SampleCanvas {
  width: number;
  height: number;
  getContext(kind: "2d"): Readonly<{ drawImage(source: unknown, x: number, y: number, width: number, height: number): void }> | null;
  toBlob(callback: (blob: Blob | null) => void, type: string): void;
}

export type SampleEnv = Readonly<{
  makeVideo: () => SampleVideo;
  makeCanvas: () => SampleCanvas;
  objectUrl: Readonly<{ create: (blob: Blob) => string; revoke: (url: string) => void }>;
  /** How long to wait for one seek before giving up on that frame. */
  timeoutMs?: number;
  /** Overridden in a test; in a browser it is `setTimeout`. */
  wait?: (ms: number) => Promise<void>;
}>;

const browserEnv = (): SampleEnv => ({
  makeVideo: () => document.createElement("video") as unknown as SampleVideo,
  makeCanvas: () => document.createElement("canvas") as unknown as SampleCanvas,
  objectUrl: { create: (blob) => URL.createObjectURL(blob), revoke: (url) => URL.revokeObjectURL(url) },
});

const once = (video: SampleVideo, type: string, timeoutMs: number, wait: (ms: number) => Promise<void>): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener(type, hit);
      resolve(value);
    };
    const hit = () => done(true);
    video.addEventListener(type, hit);
    void wait(timeoutMs).then(() => done(false));
  });

/** The one frame at this moment, or null when the seek or the draw did not work. */
async function frameAt(video: SampleVideo, canvas: SampleCanvas, atMs: number, env: Required<Pick<SampleEnv, "timeoutMs" | "wait">>): Promise<Blob | null> {
  video.currentTime = Math.max(0, atMs / 1000);
  if (!(await once(video, "seeked", env.timeoutMs, env.wait))) return null;
  const context = canvas.getContext("2d");
  if (!context) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * The frames of this clip at these moments, as PNGs. Frames that could not be read are left out, so
 * the caller can see that fewer came back than were asked for.
 */
export async function sampleVideoFrames(clip: Blob, atMs: readonly number[], given?: SampleEnv): Promise<readonly SampledFrameBlob[]> {
  const env = given ?? browserEnv();
  const timeoutMs = env.timeoutMs ?? 5000;
  const wait = env.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const video = env.makeVideo();
  const url = env.objectUrl.create(clip);
  const out: SampledFrameBlob[] = [];
  try {
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    video.load();
    if (!(await once(video, "loadeddata", timeoutMs, wait))) return out;
    const canvas = env.makeCanvas();
    for (const at of [...atMs].sort((a, b) => a - b)) {
      const png = await frameAt(video, canvas, at, { timeoutMs, wait });
      if (png) out.push({ atMs: at, png });
    }
    return out;
  } catch {
    return out;
  } finally {
    video.src = "";
    env.objectUrl.revoke(url);
  }
}
