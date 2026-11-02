import { describe, expect, it } from "vitest";
import { GENERATED_LABEL } from "@/lib/launch/assets";
import type { LogEvent } from "@/lib/server/core/guard";
import { stubBoardVideoProvider, type BoardVideoProvider, type BoardVideoRequest } from "./board-provider";
import type { ClipCheckReport } from "./frame-check";
import { MAX_CLIP_BYTES } from "./limits";
import {
  CAPPED_MESSAGE,
  MODEL_FAILED_MESSAGE,
  NOT_A_VIDEO_MESSAGE,
  runAiVideo,
  SHORT_MESSAGE,
  TOO_LARGE_MESSAGE,
  type RunAsk,
  type RunDeps,
  type RunLedger,
  type RunMeter,
} from "./run";
import { stubWebm } from "./stub";

const REQUEST: BoardVideoRequest = {
  firstFrame: new Uint8Array([1, 2, 3]),
  prompt: "orbit the player",
  seconds: 5,
  aspect: "9:16",
  audio: false,
  modelKey: "kling-2.1-standard",
};

const ASK: RunAsk = {
  request: REQUEST,
  credits: 10,
  idempotencyKey: "board-1:v1",
  sampleMs: [0, 2000, 4000],
  checkInput: { reference: new Uint8Array([7]), protectedRegions: [] },
};

const PASSED: ClipCheckReport = { verdict: "passed", frames: [], firstFailureMs: null, message: null, thresholdsNote: "note", ruleId: "R-GAP-000" };
const REJECTED: ClipCheckReport = { verdict: "rejected", frames: [], firstFailureMs: 2000, message: "The garment changed part way through the clip (at 00:02).", thresholdsNote: "note", ruleId: "R-GAP-000" };

const ledger = (balance = 100) => {
  const calls: string[] = [];
  let left = balance;
  const service: RunLedger = {
    spend: async ({ credits }) => {
      calls.push(`spend ${credits}`);
      if (left < credits) return { ok: false, reason: "insufficient", balance: left };
      left -= credits;
      return { ok: true, charged: true, balance: left };
    },
    refund: async ({ credits }) => {
      calls.push(`refund ${credits}`);
      left += credits;
      return { refunded: credits, balance: left };
    },
  };
  return { service, calls, balance: () => left };
};

const meter = (refuse = false) => {
  const calls: string[] = [];
  const service: RunMeter = {
    reserve: async (microdollars) => {
      calls.push(`reserve ${microdollars}`);
      return refuse ? { ok: false, refused: "global" } : { ok: true, eventId: "event-1" };
    },
    release: async (eventId) => {
      calls.push(`release ${eventId}`);
    },
  };
  return { service, calls };
};

const provider = (over: Partial<BoardVideoProvider> = {}): BoardVideoProvider => ({ ...stubBoardVideoProvider(), costPerSecondMicrodollars: 50_000, ...over });

const deps = (over: Partial<RunDeps> = {}): RunDeps & { readonly logs: LogEvent[] } => {
  const logs: LogEvent[] = [];
  return {
    provider: provider(),
    ledger: ledger().service,
    meter: meter().service,
    sample: async (_video, atMs) => atMs.map((at) => ({ atMs: at, png: new Uint8Array([1]) })),
    log: (event) => logs.push(event),
    check: async () => PASSED,
    logs,
    ...over,
  };
};

const signal = () => new AbortController().signal;

describe("a run that works", () => {
  it("reserves the platform's spend, charges the credits and gives back a labelled clip", async () => {
    const money = ledger();
    const cap = meter();
    const outcome = await runAiVideo(deps({ ledger: money.service, meter: cap.service }), ASK, signal());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.spent).toBe(10);
    expect(outcome.label).toBe(GENERATED_LABEL);
    expect(outcome.type).toBe("video/webm");
    expect(outcome.checker.verdict).toBe("passed");
    expect(money.calls).toEqual(["spend 10"]);
    expect(money.balance()).toBe(90);
    expect(cap.calls).toEqual(["reserve 250000"]);
  });

  it("reserves what the model costs the platform, by the second", async () => {
    const cap = meter();
    await runAiVideo(deps({ meter: cap.service, provider: provider({ costPerSecondMicrodollars: 1000 }) }), ASK, signal());
    expect(cap.calls[0]).toBe("reserve 5000");
  });

  it("reserves at least something even for a model the platform pays nothing for", async () => {
    const cap = meter();
    await runAiVideo(deps({ meter: cap.service, provider: stubBoardVideoProvider() }), ASK, signal());
    expect(cap.calls[0]).toBe("reserve 1");
  });

  it("checks every moment the plan asked for, not just the first frame", async () => {
    let asked: readonly number[] = [];
    await runAiVideo(
      deps({
        check: async (input) => {
          asked = input.frames.map((frame) => frame.atMs);
          return PASSED;
        },
      }),
      ASK,
      signal(),
    );
    expect(asked).toEqual([0, 2000, 4000]);
  });

  it("charges nothing at all while charging is off, and still gives back the clip", async () => {
    const outcome = await runAiVideo(deps({ ledger: null }), ASK, signal());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.spent).toBe(0);
  });

  it("spends nothing twice: a repeat of the same run is charged once by the ledger's own key", async () => {
    const charged: string[] = [];
    const once: RunLedger = {
      spend: async ({ idempotencyKey }) => {
        const first = !charged.includes(idempotencyKey);
        charged.push(idempotencyKey);
        return { ok: true, charged: first, balance: 90 };
      },
      refund: async () => ({ refunded: 0, balance: 90 }),
    };
    const first = await runAiVideo(deps({ ledger: once }), ASK, signal());
    const again = await runAiVideo(deps({ ledger: once }), ASK, signal());
    expect(first.ok && first.spent).toBe(10);
    expect(again.ok && again.spent).toBe(0);
  });
});

describe("a run that is refused before anything is spent", () => {
  it("stops at the platform's own cap, charging nothing", async () => {
    const money = ledger();
    const outcome = await runAiVideo(deps({ ledger: money.service, meter: meter(true).service }), ASK, signal());
    expect(outcome).toMatchObject({ ok: false, message: CAPPED_MESSAGE, spent: 0, refunded: 0 });
    expect(money.calls).toEqual([]);
  });

  it("stops at a short balance, and gives the reservation back", async () => {
    const money = ledger(4);
    const cap = meter();
    const outcome = await runAiVideo(deps({ ledger: money.service, meter: cap.service }), ASK, signal());
    expect(outcome).toMatchObject({ ok: false, message: SHORT_MESSAGE, refunded: 0 });
    expect(money.balance()).toBe(4);
    expect(cap.calls).toEqual(["reserve 250000", "release event-1"]);
  });
});

describe("a run that fails after the charge", () => {
  const failures: readonly (readonly [string, Partial<RunDeps>, string])[] = [
    ["the model refused", { provider: provider({ generate: async () => ({ ok: false, message: "no" }) }) }, MODEL_FAILED_MESSAGE],
    ["what came back is not a video", { provider: provider({ generate: async () => ({ ok: true, video: new Uint8Array([1, 2, 3]), type: "video/mp4" }) }) }, NOT_A_VIDEO_MESSAGE],
    [
      "the clip is too large to keep",
      {
        provider: provider({
          generate: async () => {
            const padded = new Uint8Array(MAX_CLIP_BYTES + 1);
            padded.set(stubWebm(new Uint8Array([1]), 5).slice(0, 8), 0);
            return { ok: true, video: padded, type: "video/webm" };
          },
        }),
      },
      TOO_LARGE_MESSAGE,
    ],
    ["the model threw", { provider: provider({ generate: async () => { throw new Error("socket"); } }) }, MODEL_FAILED_MESSAGE],
  ];

  for (const [what, over, message] of failures) {
    it(`gives the credits back when ${what}`, async () => {
      const money = ledger();
      const cap = meter();
      const outcome = await runAiVideo(deps({ ledger: money.service, meter: cap.service, ...over }), ASK, signal());
      expect(outcome).toMatchObject({ ok: false, message, spent: 0, refunded: 10 });
      expect(money.calls).toEqual(["spend 10", "refund 10"]);
      expect(money.balance()).toBe(100);
      expect(cap.calls).toEqual(["reserve 250000", "release event-1"]);
    });
  }

  it("gives the credits back when the checker turns a frame away, and says which moment", async () => {
    const money = ledger();
    const outcome = await runAiVideo(deps({ ledger: money.service, check: async () => REJECTED }), ASK, signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain("00:02");
    expect(outcome.refunded).toBe(10);
    expect(money.balance()).toBe(100);
  });

  it("gives the credits back when no frames could be sampled out of the clip", async () => {
    const money = ledger();
    const outcome = await runAiVideo(deps({ ledger: money.service, sample: async () => [], check: undefined }), ASK, signal());
    expect(outcome).toMatchObject({ ok: false, refunded: 10 });
    expect(money.balance()).toBe(100);
  });

  it("refunds nothing while charging is off, because nothing was charged", async () => {
    const outcome = await runAiVideo(deps({ ledger: null, check: async () => REJECTED }), ASK, signal());
    expect(outcome).toMatchObject({ ok: false, spent: 0, refunded: 0 });
  });

  it("still reports the failure when the refund itself fails, and logs it", async () => {
    const broken: RunLedger = {
      spend: async () => ({ ok: true, charged: true, balance: 90 }),
      refund: async () => {
        throw new Error("ledger down");
      },
    };
    const made = deps({ ledger: broken, check: async () => REJECTED });
    const outcome = await runAiVideo(made, ASK, signal());
    expect(outcome).toMatchObject({ ok: false, refunded: 0 });
    expect(made.logs.some((event) => event.level === "error")).toBe(true);
  });

  it("still reports the failure when the reservation cannot be released", async () => {
    const broken: RunMeter = {
      reserve: async () => ({ ok: true, eventId: "event-1" }),
      release: async () => {
        throw new Error("meter down");
      },
    };
    const made = deps({ meter: broken, check: async () => REJECTED });
    const outcome = await runAiVideo(made, ASK, signal());
    expect(outcome.ok).toBe(false);
    expect(made.logs.some((event) => event.level === "warn")).toBe(true);
  });
});
