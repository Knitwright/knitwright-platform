import { describe, expect, it, vi } from "vitest";
import { recordCanvas, type RecordOptions } from "./record";

const options: RecordOptions = { seconds: 1, revolutionSeconds: 1, maxBytes: 100, mimeTypes: ["video/webm;codecs=vp9", "video/webm"], bitsPerSecond: 1000, turnEvent: "t" };

class FakeRecorder {
  static supported = ["video/webm"];
  static chunk = new Blob([new Uint8Array(10)]);
  static fail = false;
  static isTypeSupported = (type: string) => FakeRecorder.supported.includes(type);
  static lastType = "";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, init: { mimeType: string }) {
    FakeRecorder.lastType = init.mimeType;
  }
  start() {}
  stop() {
    if (FakeRecorder.fail) this.onerror?.();
    this.ondataavailable?.({ data: FakeRecorder.chunk });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const canvas = (over: Record<string, unknown> = {}) => {
  const events: unknown[] = [];
  const element = {
    captureStream: () => ({ getTracks: () => [track] }),
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"])),
    dispatchEvent: (e: CustomEvent) => events.push(e.detail),
    ...over,
  };
  return { element: element as unknown as HTMLCanvasElement, events };
};
const env = { MediaRecorder: FakeRecorder as never, wait: async () => {} };

describe("recordCanvas", () => {
  it("records with the first type the browser supports, turns the model once, then stops it", async () => {
    FakeRecorder.fail = false;
    const c = canvas();
    const result = await recordCanvas(c.element, options, env);
    expect(result.ok).toBe(true);
    expect(FakeRecorder.lastType).toBe("video/webm");
    expect(c.events).toEqual([{ revolutionSeconds: 1 }, { revolutionSeconds: null }]);
    if (result.ok) expect(result.recording.video.type).toBe("video/webm");
    expect(track.stop).toHaveBeenCalled();
  });
  it("says unsupported without a recorder, a usable type or captureStream", async () => {
    expect(await recordCanvas(canvas().element, options, { MediaRecorder: undefined })).toEqual({ ok: false, reason: "unsupported" });
    FakeRecorder.supported = [];
    expect(await recordCanvas(canvas().element, options, env)).toEqual({ ok: false, reason: "unsupported" });
    FakeRecorder.supported = ["video/webm"];
    expect(await recordCanvas(canvas({ captureStream: undefined }).element, options, env)).toEqual({ ok: false, reason: "unsupported" });
  });
  it("fails in words-ready codes when nothing is recorded, the poster is missing, or the recorder errors", async () => {
    FakeRecorder.chunk = new Blob([]);
    expect(await recordCanvas(canvas().element, options, env)).toEqual({ ok: false, reason: "failed" });
    FakeRecorder.chunk = new Blob([new Uint8Array(10)]);
    expect(await recordCanvas(canvas({ toBlob: (cb: (b: Blob | null) => void) => cb(null) }).element, options, env)).toEqual({ ok: false, reason: "failed" });
    FakeRecorder.fail = true;
    expect(await recordCanvas(canvas().element, options, env)).toEqual({ ok: false, reason: "failed" });
    FakeRecorder.fail = false;
  });
  it("refuses a recording over the size cap", async () => {
    FakeRecorder.chunk = new Blob([new Uint8Array(500)]);
    expect(await recordCanvas(canvas().element, options, env)).toEqual({ ok: false, reason: "too_large" });
    FakeRecorder.chunk = new Blob([new Uint8Array(10)]);
  });
});
