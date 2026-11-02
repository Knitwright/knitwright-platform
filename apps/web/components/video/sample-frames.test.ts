import { describe, expect, it } from "vitest";
import { sampleVideoFrames, type SampleEnv } from "./sample-frames";

/**
 * A fake video element and canvas, so the frame sampling is tested without a browser and without
 * ever decoding a real video. The real thing runs in Chromium in the end-to-end test.
 */
function fakes(options: Readonly<{ loads?: boolean; seeks?: boolean; blob?: Blob | null; context?: boolean }> = {}) {
  const listeners = new Map<string, (() => void)[]>();
  const revoked: string[] = [];
  const drawn: number[] = [];
  let currentTime = 0;
  const fire = (type: string): void => {
    for (const listener of listeners.get(type) ?? []) listener();
  };
  const video = {
    get currentTime() {
      return currentTime;
    },
    set currentTime(value: number) {
      currentTime = value;
      if (options.seeks !== false) queueMicrotask(() => fire("seeked"));
    },
    videoWidth: 1080,
    videoHeight: 1920,
    src: "",
    muted: false,
    preload: "",
    addEventListener: (type: string, listener: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: (type: string, listener: () => void) => listeners.set(type, (listeners.get(type) ?? []).filter((one) => one !== listener)),
    load: () => {
      if (options.loads !== false) queueMicrotask(() => fire("loadeddata"));
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (options.context === false ? null : { drawImage: () => drawn.push(currentTime) }),
    toBlob: (callback: (blob: Blob | null) => void) => callback(options.blob === undefined ? new Blob(["png"]) : options.blob),
  };
  const env: SampleEnv = {
    makeVideo: () => video,
    makeCanvas: () => canvas,
    objectUrl: { create: () => "blob:clip", revoke: (url) => revoked.push(url) },
    timeoutMs: 20,
    wait: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  };
  return { env, revoked, drawn, canvas };
}

const clip = new Blob(["webm"]);

describe("taking frames out of a finished clip", () => {
  it("takes one frame at each moment asked for, in time order", async () => {
    const made = fakes();
    const frames = await sampleVideoFrames(clip, [4000, 0, 2000], made.env);
    expect(frames.map((frame) => frame.atMs)).toEqual([0, 2000, 4000]);
    expect(made.drawn).toEqual([0, 2, 4]);
    expect(frames[0]?.png.size).toBeGreaterThan(0);
  });

  it("draws the frame at the clip's own size", async () => {
    const made = fakes();
    await sampleVideoFrames(clip, [0], made.env);
    expect(made.canvas).toMatchObject({ width: 1080, height: 1920 });
  });

  it("gives back the object address whatever happens", async () => {
    const made = fakes();
    await sampleVideoFrames(clip, [0], made.env);
    expect(made.revoked).toEqual(["blob:clip"]);
  });

  it("gives back nothing when the clip never loads", async () => {
    const made = fakes({ loads: false });
    expect(await sampleVideoFrames(clip, [0, 1000], made.env)).toEqual([]);
    expect(made.revoked).toEqual(["blob:clip"]);
  });

  it("leaves out a frame that could not be seeked to, rather than making one up", async () => {
    const made = fakes({ seeks: false });
    expect(await sampleVideoFrames(clip, [0, 1000], made.env)).toEqual([]);
  });

  it("leaves out a frame the canvas could not draw", async () => {
    expect(await sampleVideoFrames(clip, [0], fakes({ context: false }).env)).toEqual([]);
    expect(await sampleVideoFrames(clip, [0], fakes({ blob: null }).env)).toEqual([]);
  });

  it("asks for no frames at all without failing", async () => {
    expect(await sampleVideoFrames(clip, [], fakes().env)).toEqual([]);
  });
});
