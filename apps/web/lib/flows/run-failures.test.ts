import { describe, expect, it } from "vitest";
import { canvasOfTemplate } from "./fixtures/canvas";
import { runFlow, type Charge, type FlowCapability, type FlowMeter, type FlowRecorder } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";

/**
 * What happens when somebody else's code breaks.
 *
 * A capability is another workstream's adapter reaching a model over a network, and a recorder is a
 * write to the database. Either may **throw** rather than answer, and a throw that got out of the
 * run engine would be the worst outcome this directory can produce: the board was already charged,
 * so the brand is short, and nothing was recorded, so no row names the charge. These tests are the
 * ones that keep decision 0096's third promise -- a board that fails gives its credits back -- true
 * for the failure a real adapter actually has, rather than only for the polite one.
 */

const throwing = (boardId: string): FlowCapability => ({
  run: async (request) => {
    if (request.boardId === boardId) throw new Error("the model went away");
    return (await stubCapability().run(request)) as never;
  },
});

const brokenRecorder = (on: "running" | "ready"): FlowRecorder => ({
  record: async (input) => {
    if (input.status === on) throw new Error("the row would not write");
  },
});

/** A meter that takes more than the figure it was given, which must never be let through. */
const greedyMeter = (): FlowMeter & Readonly<{ moves: readonly string[] }> => {
  const moves: string[] = [];
  return {
    moves,
    charge: async (input): Promise<Charge> => {
      moves.push(`charge ${input.boardId}`);
      return { ok: true, charged: true, credits: input.credits + 5, entryId: `entry-${input.boardId}` };
    },
    refund: async (input): Promise<number> => {
      moves.push(`refund ${input.boardId} ${input.credits}`);
      return input.credits;
    },
  };
};

describe("a capability that throws", () => {
  it("fails that board, gives its credits back, and lets the run carry on", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const meter = stubMeter({ balance: 100 });
    const report = await runFlow({ capability: throwing("line-up"), meter, recorder: stubRecorder() }, graph, { from: null, scope: "all" }, STUB_COSTS);
    const failed = report.lines.find((line) => line.boardId === "line-up");

    expect(failed?.state).toBe("failed");
    expect(failed?.reason).toContain("could not be run just now");
    expect(failed?.refunded).toBe(1);
    expect(failed?.credits).toBe(0);
    // The other two scenes were charged and kept; only this one's credit came back.
    expect(meter.balance()).toBe(98);
    expect(report.state).toBe("part_done");
    expect(report.lines.filter((line) => line.state === "ready").length).toBeGreaterThan(5);
  });
});

describe("a recorder that throws", () => {
  it("fails the board rather than the run when the status will not write", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: brokenRecorder("running") },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    // The first board fails; the boards it feeds are skipped, which is the normal consequence.
    expect(report.lines.every((line) => line.state === "failed" || line.state === "skipped")).toBe(true);
    expect(report.lines[0]?.state).toBe("failed");
    expect(report.lines[0]?.reason).toContain("status could not be saved");
    expect(report.assets).toBe(0);
  });

  it("keeps no picture when the picture itself will not write", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: brokenRecorder("ready") },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(report.lines[0]?.state).toBe("failed");
    expect(report.lines[0]?.reason).toContain("could not be saved");
    expect(report.assets).toBe(0);
  });
});

describe("a meter that takes more than the figure on the button", () => {
  it("gives it straight back and fails the board, because the figure shown is the most that may be taken", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const meter = greedyMeter();
    const report = await runFlow({ capability: stubCapability(), meter, recorder: stubRecorder() }, graph, { from: null, scope: "all" }, STUB_COSTS);
    const paid = report.lines.filter((line) => line.state === "failed");

    expect(paid).toHaveLength(3);
    expect(paid[0]?.reason).toContain("turned out to cost 6 credits rather than the 1 you were shown");
    expect(paid[0]?.refunded).toBe(6);
    expect(report.spent).toBe(0);
    expect(meter.moves.filter((one) => one.startsWith("refund"))).toHaveLength(3);
  });
});

describe("the ledger line a run names", () => {
  it("is carried out of the run on every board that was charged", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const report = await runFlow({ capability: stubCapability(), meter: stubMeter({ balance: 100 }), recorder: stubRecorder() }, graph, { from: null, scope: "all" }, STUB_COSTS);
    const scene = report.lines.find((line) => line.boardId === "line-up");
    const render = report.lines.find((line) => line.boardId === "render-front");

    expect(scene?.entryId).toBe("entry-line-up");
    expect(render?.entryId).toBeNull();
  });

  it("is carried out on a board that failed as well, so a charge is never unaccounted for", async () => {
    const { graph } = canvasOfTemplate("club-kit-launch-pack");
    const report = await runFlow(
      { capability: stubCapability({ failing: ["tunnel"] }), meter: stubMeter({ balance: 100 }), recorder: stubRecorder() },
      graph,
      { from: null, scope: "all" },
      STUB_COSTS,
    );

    expect(report.lines.find((line) => line.boardId === "tunnel")?.entryId).toBe("entry-tunnel");
  });
});
