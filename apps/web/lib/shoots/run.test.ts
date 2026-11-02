import { describe, expect, it } from "vitest";
import { GENERATED_LABEL, GENERATED_PERSON_LABEL, acceptAsset, type LaunchAsset } from "@/lib/launch/assets";
import { marksFor, panelsFor, referencePng, generatedPng } from "@/lib/media-check/fixtures/synthetic";
import type { Verdict } from "@/lib/moderation/types";
import { DRIFT_MESSAGE, type ShootCheckReport } from "./check";
import type { ShootProvider, ShootRequest } from "./provider";
import {
  BLOCKED_MESSAGE,
  CAPPED_MESSAGE,
  MODEL_FAILED_MESSAGE,
  SHORT_MESSAGE,
  labelFor,
  refundNote,
  resultLabel,
  runShoot,
  shootSceneAsset,
  type ShootRunAsk,
  type ShootRunDeps,
} from "./run";
import { failingShootProvider, stubShootProvider } from "./stub";
import { SHOOT_GAP_RULE } from "./types";

/**
 * ONE PAID SHOOT, AND EVERY DOOR OUT OF IT. The rule being tested is one sentence of F-L1 -- "Failed
 * generations refund credits" -- and the way to test it is to walk every way a shoot can fail and
 * ask the ledger what it holds afterwards.
 *
 * Nothing here calls anything: the provider is the deterministic stub, the meter and the ledger are
 * recordings, and X8's generation hook is a function that answers.
 */

const SIZE = 320;
const CLEAR: Verdict = { result: "clear", reasons: [] };
const BLOCKED: Verdict = { result: "blocked", reasons: [{ code: "vision_offensive", severity: "block", message: "No.", ruleId: SHOOT_GAP_RULE }] };

function meter(refusals = 0) {
  const calls = { reserved: [] as number[], released: [] as string[] };
  let refused = refusals;
  return {
    calls,
    meter: {
      async reserve(microdollars: number) {
        calls.reserved.push(microdollars);
        if (refused > 0) {
          refused -= 1;
          return { ok: false as const, refused: "the cap" };
        }
        return { ok: true as const, eventId: `event-${calls.reserved.length}` };
      },
      async release(eventId: string) {
        calls.released.push(eventId);
      },
    },
  };
}

/** A meter that refuses only the nth reservation, so the retry's own cap can be tested. */
function meterRefusingAt(nth: number) {
  const calls = { reserved: [] as number[], released: [] as string[] };
  return {
    calls,
    meter: {
      async reserve(microdollars: number) {
        calls.reserved.push(microdollars);
        if (calls.reserved.length === nth) return { ok: false as const, refused: "the cap" };
        return { ok: true as const, eventId: `event-${calls.reserved.length}` };
      },
      async release(eventId: string) {
        calls.released.push(eventId);
      },
    },
  };
}

function ledger(options: { short?: boolean; charged?: boolean; refundThrows?: boolean } = {}) {
  const calls = { spends: [] as { credits: number; idempotencyKey: string }[], refunds: [] as { credits: number; reason: string }[] };
  return {
    calls,
    ledger: {
      async spend(input: { credits: number; idempotencyKey: string }) {
        calls.spends.push(input);
        if (options.short) return { ok: false as const, reason: "insufficient" as const, balance: 0 };
        return { ok: true as const, charged: options.charged ?? true, balance: 10 };
      },
      async refund(input: { credits: number; reason: string }) {
        calls.refunds.push(input);
        if (options.refundThrows) throw new Error("the ledger fell over");
        return { refunded: input.credits, balance: 10 + input.credits };
      },
    },
  };
}

const logs = () => {
  const events: unknown[] = [];
  return { events, log: (event: unknown) => events.push(event) };
};

const ask = async (over: Partial<ShootRunAsk> = {}): Promise<ShootRunAsk> => ({
  request: {
    garment: await referencePng(SIZE),
    extraGarments: [],
    modelPhoto: null,
    background: null,
    prompt: "A shoot",
    crop: "1:1",
    sceneSlug: "floodlit-pitch",
    seed: 1,
  } satisfies ShootRequest,
  credits: 2,
  idempotencyKey: "shoot:board-1",
  jobId: "job-1",
  checkInput: { reference: await referencePng(SIZE), protectedRegions: marksFor(SIZE), panels: panelsFor(SIZE) },
  showsPerson: true,
  seedFor: (attempt) => attempt,
  ...over,
});

const kept: ShootCheckReport = { verdict: "kept", findings: [], failedChecks: [], message: null, thresholdsNote: "note", ruleId: SHOOT_GAP_RULE };
const turnedAway: ShootCheckReport = {
  verdict: "turned_away",
  findings: [],
  failedChecks: ["colour"],
  message: `${DRIFT_MESSAGE}.`,
  thresholdsNote: "note",
  ruleId: SHOOT_GAP_RULE,
};

const deps = (over: Partial<ShootRunDeps> = {}): ShootRunDeps => ({
  provider: stubShootProvider(),
  ledger: null,
  meter: meter().meter,
  screen: async () => CLEAR,
  log: () => undefined,
  check: async () => kept,
  ...over,
});

const signal = () => new AbortController().signal;

describe("a shoot that works", () => {
  it("gives back the picture, what it cost, and the label the spec puts on it", async () => {
    const money = ledger();
    const outcome = await runShoot(deps({ ledger: money.ledger }), await ask(), signal());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.attempts).toBe(1);
    expect(outcome.spent).toBe(2);
    expect(outcome.label).toBe(GENERATED_PERSON_LABEL);
    expect(outcome.png.byteLength).toBeGreaterThan(0);
    expect(money.calls.refunds).toEqual([]);
  });

  it("charges nothing while charging is off, and still says what the shoot would cost", async () => {
    const outcome = await runShoot(deps(), await ask(), signal());
    expect(outcome.ok && outcome.spent).toBe(0);
  });

  it("charges once, on the key the board gave it", async () => {
    const money = ledger();
    await runShoot(deps({ ledger: money.ledger }), await ask(), signal());
    expect(money.calls.spends).toEqual([{ credits: 2, idempotencyKey: "shoot:board-1" }]);
  });

  it("holds no credits spent when the ledger says this run was already charged for", async () => {
    const money = ledger({ charged: false });
    const outcome = await runShoot(deps({ ledger: money.ledger }), await ask(), signal());
    expect(outcome.ok && outcome.spent).toBe(0);
  });

  it("labels a garment with nobody in it as generated, without claiming a person was", async () => {
    const outcome = await runShoot(deps(), await ask({ showsPerson: false }), signal());
    expect(outcome.ok && outcome.label).toBe(GENERATED_LABEL);
  });

  it("screens the picture and the prompt together, against the job it belongs to", async () => {
    const seen: { generationId: string; prompt: string }[] = [];
    await runShoot(
      deps({
        screen: async (input) => {
          seen.push({ generationId: input.generationId, prompt: input.prompt });
          return CLEAR;
        },
      }),
      await ask(),
      signal(),
    );
    expect(seen).toEqual([{ generationId: "job-1", prompt: "A shoot" }]);
  });

  it("keeps a flagged picture and leaves the verdict on it for the review queue", async () => {
    const flagged: Verdict = { result: "flagged", reasons: [{ code: "vision_mark", severity: "flag", message: "A look is needed.", ruleId: SHOOT_GAP_RULE }] };
    const outcome = await runShoot(deps({ screen: async () => flagged }), await ask(), signal());
    expect(outcome.ok && outcome.moderation.result).toBe("flagged");
  });
});

describe("the one automatic second attempt", () => {
  it("runs again with a new seed and keeps the second picture, charging nothing more", async () => {
    const money = ledger();
    const seeds: number[] = [];
    let attempt = 0;
    const provider: ShootProvider = {
      name: "counting",
      costPerImageMicrodollars: 10,
      async generate(request) {
        seeds.push(request.seed);
        return stubShootProvider().generate(request, signal());
      },
    };
    const outcome = await runShoot(
      deps({
        provider,
        ledger: money.ledger,
        check: async () => {
          attempt += 1;
          return attempt === 1 ? turnedAway : kept;
        },
      }),
      await ask(),
      signal(),
    );
    expect(outcome.ok && outcome.attempts).toBe(2);
    expect(seeds).toEqual([1, 2]);
    expect(money.calls.spends).toHaveLength(1);
    expect(money.calls.refunds).toEqual([]);
  });

  it("reserves the platform's own spend again, because the second call really costs the platform", async () => {
    const spend = meter();
    let attempt = 0;
    await runShoot(
      deps({
        meter: spend.meter,
        provider: { ...stubShootProvider(), costPerImageMicrodollars: 2500 },
        check: async () => {
          attempt += 1;
          return attempt === 1 ? turnedAway : kept;
        },
      }),
      await ask(),
      signal(),
    );
    expect(spend.calls.reserved).toEqual([2500, 2500]);
    expect(spend.calls.released).toEqual([]);
  });

  it("gives up after the second, says the spec's sentence and gives the credits back", async () => {
    const money = ledger();
    const spend = meter();
    const outcome = await runShoot(deps({ ledger: money.ledger, meter: spend.meter, check: async () => turnedAway }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.attempts).toBe(2);
    expect(outcome.message).toMatch(DRIFT_MESSAGE);
    expect(outcome.spent).toBe(0);
    expect(outcome.refunded).toBe(2);
    expect(money.calls.refunds[0]!.credits).toBe(2);
    expect(spend.calls.released).toEqual(["event-1", "event-2"]);
  });

  it("is not tried for a failure a second attempt could not fix", async () => {
    const money = ledger();
    const outcome = await runShoot(deps({ ledger: money.ledger, provider: failingShootProvider("no") }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.attempts).toBe(1);
    expect(outcome.message).toBe(MODEL_FAILED_MESSAGE);
    expect(outcome.refunded).toBe(2);
  });
});

describe("every other door out, and the money behind it", () => {
  it("refunds a picture our review blocked", async () => {
    const money = ledger();
    const outcome = await runShoot(deps({ ledger: money.ledger, screen: async () => BLOCKED }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toBe(BLOCKED_MESSAGE);
    expect(outcome.refunded).toBe(2);
  });

  it("charges nothing at all when the platform's own cap is reached", async () => {
    const money = ledger();
    const spend = meter(1);
    const outcome = await runShoot(deps({ ledger: money.ledger, meter: spend.meter }), await ask(), signal());
    expect(outcome).toEqual({ ok: false, message: CAPPED_MESSAGE, attempts: 0, spent: 0, refunded: 0, ruleId: SHOOT_GAP_RULE });
    expect(money.calls.spends).toEqual([]);
  });

  it("gives the credits back when the cap is reached between the two attempts", async () => {
    const money = ledger();
    const spend = meterRefusingAt(2);
    const outcome = await runShoot(deps({ ledger: money.ledger, meter: spend.meter, check: async () => turnedAway }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toBe(CAPPED_MESSAGE);
    expect(outcome.refunded).toBe(2);
    expect(spend.calls.released).toEqual(["event-1"]);
  });

  it("runs nothing when the brand cannot afford it, and lets the reservation go", async () => {
    const money = ledger({ short: true });
    const spend = meter();
    const outcome = await runShoot(deps({ ledger: money.ledger, meter: spend.meter }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toBe(SHORT_MESSAGE);
    expect(outcome.refunded).toBe(0);
    expect(spend.calls.released).toEqual(["event-1"]);
  });

  it("refunds and logs when the provider throws rather than answering", async () => {
    const money = ledger();
    const trail = logs();
    const provider: ShootProvider = {
      name: "throwing",
      costPerImageMicrodollars: 1,
      async generate() {
        throw new Error("the socket closed");
      },
    };
    const outcome = await runShoot(deps({ ledger: money.ledger, provider, log: trail.log }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toBe(MODEL_FAILED_MESSAGE);
    expect(outcome.refunded).toBe(2);
    expect(trail.events).toHaveLength(1);
  });

  it("logs, rather than throwing, when the refund itself fails: the person still gets an answer", async () => {
    const money = ledger({ refundThrows: true });
    const trail = logs();
    const outcome = await runShoot(deps({ ledger: money.ledger, log: trail.log, provider: failingShootProvider("no") }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refunded).toBe(0);
    expect(trail.events).toHaveLength(1);
  });

  it("logs, rather than throwing, when a reservation cannot be released", async () => {
    const trail = logs();
    const brokenMeter = {
      async reserve() {
        return { ok: true as const, eventId: "event-1" };
      },
      async release() {
        throw new Error("the meter fell over");
      },
    };
    const outcome = await runShoot(deps({ meter: brokenMeter, log: trail.log, provider: failingShootProvider("no") }), await ask(), signal());
    expect(outcome.ok).toBe(false);
    expect(trail.events).toHaveLength(1);
  });

  it("measures the real picture when no checker is handed in, and turns a drifted one away", async () => {
    const money = ledger();
    const provider: ShootProvider = {
      name: "drifting",
      costPerImageMicrodollars: 0,
      async generate() {
        return { ok: true, png: await generatedPng({ shiftX: 60 }, SIZE) };
      },
    };
    const outcome = await runShoot({ ...deps({ ledger: money.ledger, provider }), check: undefined }, await ask(), signal());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toMatch(DRIFT_MESSAGE);
    expect(outcome.refunded).toBe(2);
  });
});

describe("what the shell is handed, and what it can never be", () => {
  it("is scenery, and an AI image board takes it", () => {
    const asset = shootSceneAsset({ fileId: "file-1", contentType: "image/png" }, true);
    expect(asset.role).toBe("scene");
    expect(asset.provenance).toBe("generated");
    expect(acceptAsset("ai_image", asset)).toEqual({ accepted: true, role: "asset" });
    expect(resultLabel(asset)).toBe(GENERATED_PERSON_LABEL);
    expect(resultLabel(shootSceneAsset({ fileId: "f", contentType: "image/png" }, false))).toBe(GENERATED_LABEL);
  });

  it("can never be a layer on the garment or part of a print file", () => {
    const asset = shootSceneAsset({ fileId: "file-1", contentType: "image/png" }, true);
    // The type system already refuses this: a generated asset has no role but "scene". The cast is
    // what a value read back out of the database looks like, and the writer refuses it as well.
    for (const role of ["panel_layer", "print_file"] as const) {
      const forged = { ...asset, role } as unknown as LaunchAsset;
      expect(acceptAsset("ai_image", forged).accepted).toBe(false);
      expect(acceptAsset("mockup", forged).accepted).toBe(false);
    }
  });

  it("is refused by a board the platform draws itself", () => {
    const asset = shootSceneAsset({ fileId: "file-1", contentType: "image/png" }, false);
    for (const kind of ["design", "artboard", "mockup", "marketing", "info_card"] as const) {
      expect(acceptAsset(kind, asset).accepted, kind).toBe(false);
    }
  });

  it("names the label by whether a person is in the picture", () => {
    expect(labelFor(true)).toBe(GENERATED_PERSON_LABEL);
    expect(labelFor(false)).toBe(GENERATED_LABEL);
  });

  it("writes the same words on the ledger line as the screen shows", () => {
    expect(refundNote(2)).toMatch(/2 images could not keep the garment/);
  });
});
