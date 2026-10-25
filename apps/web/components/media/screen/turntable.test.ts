import { describe, expect, it } from "vitest";
import { NO_PROJECT_MESSAGE, NO_VIEW_MESSAGE, RECORD_FAILED_MESSAGE, SAVED_LABEL, SAVE_FAILED_MESSAGE, TOO_BIG_MESSAGE, UNSUPPORTED_MESSAGE } from "@/lib/media/video/copy";
import { setOf } from "./fixtures";
import { recordTurntable, type TurntableDeps } from "./turntable";

const canvas = {} as HTMLCanvasElement;
const saved = setOf();
const recording = { video: new Blob(["v"], { type: "video/webm" }), poster: new Blob(["p"], { type: "image/png" }) };

const deps = (over: Partial<TurntableDeps> = {}): TurntableDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    findCanvas: () => canvas,
    canRecord: () => true,
    record: async () => (calls.push("record"), { ok: true, recording }),
    upload: async () => (calls.push("upload"), true),
    reload: async () => (calls.push("reload"), saved),
    ...over,
  };
};

describe("recordTurntable", () => {
  it("records, uploads and reads the set again", async () => {
    const d = deps();
    expect(await recordTurntable(d)).toEqual({ message: SAVED_LABEL, tone: "ok", set: saved });
    expect(d.calls).toEqual(["record", "upload", "reload"]);
  });

  it("asks for the 3D view first and records nothing without it", async () => {
    const d = deps({ findCanvas: () => null });
    expect(await recordTurntable(d)).toEqual({ message: NO_VIEW_MESSAGE, tone: "warn", set: null });
    expect(d.calls).toEqual([]);
  });

  it("says so in words in a browser that cannot record, and saves nothing", async () => {
    const d = deps({ canRecord: () => false });
    expect(await recordTurntable(d)).toEqual({ message: UNSUPPORTED_MESSAGE, tone: "warn", set: null });
    expect(d.calls).toEqual([]);
  });

  it.each([
    ["unsupported", UNSUPPORTED_MESSAGE],
    ["too_large", TOO_BIG_MESSAGE],
    ["failed", RECORD_FAILED_MESSAGE],
  ] as const)("explains a recording that ended as %s and uploads nothing", async (reason, message) => {
    const d = deps({ record: async () => ({ ok: false, reason }) });
    expect(await recordTurntable(d)).toEqual({ message, tone: "warn", set: null });
    expect(d.calls).toEqual([]);
  });

  it("explains an upload the server refused, and does not read the set", async () => {
    const d = deps({ upload: async () => false });
    expect(await recordTurntable(d)).toEqual({ message: SAVE_FAILED_MESSAGE, tone: "warn", set: null });
    expect(d.calls).toEqual(["record"]);
  });

  it("turns a thrown error into the recording sentence", async () => {
    const d = deps({ record: async () => Promise.reject(new Error("boom")) });
    expect(await recordTurntable(d)).toEqual({ message: RECORD_FAILED_MESSAGE, tone: "warn", set: null });
  });

  it("needs a design to be open", async () => {
    expect(await recordTurntable(deps(), { projectMissing: true })).toEqual({ message: NO_PROJECT_MESSAGE, tone: "warn", set: null });
  });
});
