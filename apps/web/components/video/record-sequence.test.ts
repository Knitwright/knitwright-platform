import { describe, expect, it } from "vitest";
import { SEQUENCES, VIEW_CAPABILITIES, VIDEO_SEQUENCES } from "@/lib/media/video/sequences";
import { buildRenderPlan } from "@/lib/media/video/shot-plan";
import { abilitiesNeeded, askAbilities, playPlan, recordPlan, shotCommands, VIDEO_EVENTS, type ViewAbility } from "./record-sequence";

const plan = (key: keyof typeof VIDEO_SEQUENCES) => buildRenderPlan({ sequence: VIDEO_SEQUENCES[key], aspect: "1:1" });

type Seen = { readonly type: string; readonly detail: unknown };

const canvas = () => {
  const seen: Seen[] = [];
  return {
    seen,
    dispatchEvent(event: Event) {
      seen.push({ type: event.type, detail: (event as CustomEvent<unknown>).detail });
      return true;
    },
  };
};

const env = () => {
  const waits: number[] = [];
  return {
    waits,
    wait: async (ms: number) => {
      waits.push(ms);
    },
    event: (name: string, detail: unknown) => ({ type: name, detail }) as unknown as Event,
  };
};

describe("the names the view answers to", () => {
  it("are the ones the library declares, so the two cannot drift apart", () => {
    expect([...VIEW_CAPABILITIES].sort()).toEqual((["camera", "colourway", "turn"] satisfies ViewAbility[]).sort());
    expect(VIDEO_EVENTS.turn).toBe("knitwright:turn");
  });

  it("reuses the turn event the viewers have answered since the turntable was built", () => {
    expect(shotCommands(plan("turntable")).some((command) => command.event === "knitwright:turn")).toBe(true);
  });
});

describe("what a plan asks of the view", () => {
  it("matches what each sequence says it needs", () => {
    for (const sequence of SEQUENCES) {
      const needed = abilitiesNeeded(buildRenderPlan({ sequence, aspect: "9:16" }));
      expect([...needed].sort(), sequence.key).toEqual([...sequence.needs].sort());
    }
  });
});

describe("the commands a plan sends", () => {
  it("turns the garment once for a turntable, at the sequence's own speed", () => {
    const commands = shotCommands(plan("turntable"));
    const turn = commands.find((command) => command.event === VIDEO_EVENTS.turn);
    expect(turn?.detail).toEqual({ revolutionSeconds: 6 });
  });

  it("stops the turn and points the camera for a flip", () => {
    const commands = shotCommands(plan("flip"));
    expect(commands.find((command) => command.event === VIDEO_EVENTS.turn)?.detail).toEqual({ revolutionSeconds: 8 });
    expect(commands.find((command) => command.event === VIDEO_EVENTS.camera)?.detail).toMatchObject({ degrees: 0, seconds: 4 });
  });

  it("asks for each shot of a kit reveal in order, with its own zoom and subject", () => {
    const cameras = shotCommands(plan("kit_reveal")).filter((command) => command.event === VIDEO_EVENTS.camera);
    expect(cameras.map((command) => command.detail)).toEqual([
      { degrees: 0, zoom: 2.4, toZoom: 1.6, subject: "fabric", seconds: 3 },
      { degrees: 0, zoom: 1, subject: "garment", seconds: 3 },
      { degrees: 0, zoom: 1, toZoom: 2.2, subject: "crest", seconds: 2 },
    ]);
  });

  it("changes the colourway once per kit in a carousel, and never twice for the same one", () => {
    const changes = shotCommands(plan("carousel")).filter((command) => command.event === VIDEO_EVENTS.colourway);
    expect(changes.map((command) => command.detail)).toEqual([{ colourway: "home" }, { colourway: "away" }, { colourway: "gk" }]);
    expect(shotCommands(plan("turntable")).filter((command) => command.event === VIDEO_EVENTS.colourway)).toHaveLength(1);
  });

  it("sends every command in time order", () => {
    const times = shotCommands(plan("kit_reveal")).map((command) => command.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("asking the view what it can do", () => {
  it("takes the view's own answer", () => {
    const view = canvas();
    const answering = {
      dispatchEvent(event: Event) {
        const detail = (event as CustomEvent<{ answer?: (abilities: readonly ViewAbility[]) => void }>).detail;
        detail?.answer?.(["camera", "colourway"]);
        return true;
      },
    };
    expect(askAbilities(answering, env())).toEqual(["camera", "colourway"]);
    expect(view.seen).toEqual([]);
  });

  it("treats a view that answers nothing as one that can only turn", () => {
    expect(askAbilities(canvas(), env())).toEqual(["turn"]);
  });

  it("keeps each ability once, however often the view says it", () => {
    const twice = {
      dispatchEvent(event: Event) {
        const detail = (event as CustomEvent<{ answer?: (abilities: readonly ViewAbility[]) => void }>).detail;
        detail?.answer?.(["turn", "turn", "camera"]);
        return true;
      },
    };
    expect(askAbilities(twice, env())).toEqual(["turn", "camera"]);
  });
});

describe("playing a plan", () => {
  it("waits each shot out and stops the garment turning at the end", async () => {
    const view = canvas();
    const made = env();
    await playPlan(view, plan("carousel"), made);
    expect(made.waits).toEqual([3000, 3000, 3000]);
    expect(view.seen[view.seen.length - 1]).toEqual({ type: VIDEO_EVENTS.turn, detail: { revolutionSeconds: null } });
  });

  it("waits the whole length even for a plan of one shot", async () => {
    const made = env();
    await playPlan(canvas(), plan("flip"), made);
    expect(made.waits).toEqual([4000]);
  });
});

describe("recording a plan", () => {
  const stream = { getTracks: () => [{ stop: () => undefined }] } as unknown as MediaStream;

  const recorder = (chunk: Blob | null) =>
    class {
      static isTypeSupported = (type: string) => type.startsWith("video/webm");
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        if (chunk) this.ondataavailable?.({ data: chunk });
      }
      stop() {
        this.onstop?.();
      }
    } as unknown as { new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder; isTypeSupported(type: string): boolean };

  const options = { mimeTypes: ["video/mp4", "video/webm;codecs=vp9"], bitsPerSecond: 1000, fps: 30, maxBytes: 1024 };

  it("says plainly when the browser cannot record at all", async () => {
    const view = { ...canvas(), captureStream: () => stream };
    expect(await recordPlan(view, plan("flip"), options, { MediaRecorder: undefined, ...env() })).toEqual({ ok: false, reason: "unsupported" });
    expect(await recordPlan(canvas(), plan("flip"), options, { MediaRecorder: recorder(new Blob(["x"])), ...env() })).toEqual({ ok: false, reason: "unsupported" });
  });

  it("records the plan, and takes the first type the browser can really record", async () => {
    const view = { ...canvas(), captureStream: () => stream };
    const outcome = await recordPlan(view, plan("flip"), options, { MediaRecorder: recorder(new Blob(["abc"])), ...env() });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.mimeType).toBe("video/webm;codecs=vp9");
    expect(outcome.video.size).toBe(3);
  });

  it("keeps nothing when the recording came out empty, or too large", async () => {
    const view = { ...canvas(), captureStream: () => stream };
    expect(await recordPlan(view, plan("flip"), options, { MediaRecorder: recorder(null), ...env() })).toEqual({ ok: false, reason: "failed" });
    const big = new Blob([new Uint8Array(2048)]);
    expect(await recordPlan(view, plan("flip"), options, { MediaRecorder: recorder(big), ...env() })).toEqual({ ok: false, reason: "too_large" });
  });
});
