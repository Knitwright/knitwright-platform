import { describe, expect, it } from "vitest";
import { canvasOfTemplate, withBoard } from "./fixtures/canvas";
import { runFlow, type FlowRunLine } from "./run";
import { STUB_COSTS, stubCapability, stubMeter, stubRecorder } from "./stub";

/**
 * What a run does with money and with failure (spec F-L4: per-board status, refunds on failure).
 *
 * The Club kit pack is the canvas these use, because its three teamwear scenes are the only paid
 * boards in it: a failure there is a refund that can be counted, and a failure in a free board is a
 * refund of nothing, which must also be right.
 */

const run = async (over: Readonly<{ failing?: readonly string[]; balance?: number; enforced?: boolean; slug?: string; from?: string | null; scope?: "all" | "board" | "downstream" }> = {}) => {
  const { graph } = canvasOfTemplate(over.slug ?? "club-kit-launch-pack");
  const meter = stubMeter({ balance: over.balance ?? 100, enforced: over.enforced ?? true });
  const recorder = stubRecorder();
  const seen: FlowRunLine[] = [];
  const report = await runFlow(
    { capability: stubCapability({ failing: over.failing }), meter, recorder, onProgress: (line) => seen.push(line) },
    graph,
    { from: over.from ?? null, scope: over.scope ?? "all" },
    STUB_COSTS,
  );
  return { report, meter, recorder, seen, graph };
};

describe("a run that goes well", () => {
  it("charges each paid board once and nothing for a free one", async () => {
    const { report, meter } = await run();

    expect(meter.moves.filter((move) => move.kind === "charge")).toHaveLength(3);
    expect(meter.moves.some((move) => move.kind === "refund")).toBe(false);
    expect(report.spent).toBe(3);
    expect(report.refunded).toBe(0);
    expect(meter.balance()).toBe(97);
  });

  it("tells the canvas that each board started and then finished, so nothing looks frozen", async () => {
    const { recorder, seen } = await run();

    expect(recorder.written.filter((one) => one.status === "running")).toHaveLength(14);
    expect(recorder.written.filter((one) => one.status === "ready")).toHaveLength(14);
    expect(seen).toHaveLength(14);
    expect(seen.every((line) => line.state === "ready")).toBe(true);
  });

  it("charges nothing at all while credits are not being enforced, and still records the run", async () => {
    const { report, meter } = await run({ enforced: false });

    expect(report.spent).toBe(0);
    expect(report.assets).toBe(14);
    expect(meter.moves).toEqual([]);
  });
});

describe("a board that fails", () => {
  it("gives its credits back before the next board starts", async () => {
    const { report, meter } = await run({ failing: ["line-up"] });
    const line = report.lines.find((one) => one.boardId === "line-up");

    expect(line?.state).toBe("failed");
    expect(line?.refunded).toBe(1);
    expect(line?.credits).toBe(0);
    expect(meter.moves.filter((move) => move.boardId === "line-up")).toEqual([
      { kind: "charge", boardId: "line-up", credits: 1 },
      { kind: "refund", boardId: "line-up", credits: 1 },
    ]);
    expect(meter.balance()).toBe(98);
    expect(report.refunded).toBe(1);
  });

  it("says what went wrong and what it cost, and keeps no picture", async () => {
    const { report, recorder } = await run({ failing: ["line-up"] });

    expect(report.lines.find((one) => one.boardId === "line-up")?.reason).toContain("the credits were given back");
    expect(recorder.written.filter((one) => one.boardId === "line-up").at(-1)).toEqual({
      boardId: "line-up",
      status: "failed",
      credits: 0,
      fileId: null,
      role: null,
    });
  });

  it("skips the boards it fed rather than charging for a run with nothing to start from", async () => {
    const { report, meter } = await run({ failing: ["lifestyle-city"], slug: "brand-drop-pack" });
    const skipped = report.lines.filter((one) => one.state === "skipped");

    expect(skipped.map((one) => one.boardId)).toEqual(["drop-post", "clip-orbit"]);
    expect(skipped.every((one) => one.credits === 0 && one.refunded === 0)).toBe(true);
    expect(skipped[0]?.reason).toContain("Nothing was charged");
    expect(meter.moves.some((move) => move.boardId === "clip-orbit")).toBe(false);
  });

  it("leaves the rest of the run alone and reports part done", async () => {
    const { report } = await run({ failing: ["line-up"] });

    // The line-up scene feeds the three "new kit" posts, so those three are skipped: a post with a
    // hole where one of its two pictures should be is worse than a post that was not made.
    expect(report.state).toBe("part_done");
    expect(report.assets).toBe(10);
    expect(report.lines.filter((one) => one.state === "ready")).toHaveLength(10);
    expect(report.lines.filter((one) => one.state === "skipped")).toHaveLength(3);
  });
});

describe("a run that cannot be paid for", () => {
  it("fails the board without spending anything, and says so", async () => {
    const { report, meter } = await run({ balance: 0 });
    const paid = report.lines.filter((one) => one.state === "failed");

    expect(paid).toHaveLength(3);
    expect(paid[0]?.reason).toContain("the balance is 0");
    expect(paid[0]?.reason).toContain("Nothing was charged for this board");
    expect(meter.moves).toEqual([]);
    expect(report.spent).toBe(0);
  });

  it("still makes the free outputs a failure does not reach, because one paid board is not the canvas", async () => {
    const { report } = await run({ balance: 0 });

    // The six renders, the hanger, the turntable and the order story are made; the three teamwear
    // scenes cannot be paid for, and the three posts they feed are skipped.
    expect(report.state).toBe("part_done");
    expect(report.assets).toBe(8);
    expect(report.lines.filter((one) => one.state === "ready").map((one) => one.boardId)).toContain("turntable");
  });
});

describe("a board whose own input has not been run", () => {
  it("is skipped with the name of the board it was waiting for", async () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: "drop-post", scope: "board" },
      STUB_COSTS,
    );

    expect(report.lines[0]?.state).toBe("skipped");
    expect(report.lines[0]?.reason).toContain("has not been run yet");
    expect(report.lines[0]?.reason).toContain("City street");
  });

  it("runs once the board it waits for holds a picture", async () => {
    const { graph } = canvasOfTemplate("brand-drop-pack");
    const ready = ["lifestyle-city", "white-1-1-front"].reduce(
      (left, id) => withBoard(left, id, { status: "ready", outputFileId: "22222222-0000-4000-8000-222222222222" }),
      graph,
    );
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: stubRecorder() },
      ready,
      { from: "drop-post", scope: "board" },
      STUB_COSTS,
    );

    expect(report.lines[0]?.state).toBe("ready");
    expect(report.state).toBe("done");
  });
});

describe("a run with nothing in it", () => {
  it("is done, spends nothing and makes nothing", async () => {
    const { graph } = canvasOfTemplate("sponsor-pack");
    const report = await runFlow(
      { capability: stubCapability(), meter: stubMeter(), recorder: stubRecorder() },
      graph,
      { from: "design", scope: "board" },
      STUB_COSTS,
    );

    expect(report.lines).toEqual([]);
    expect(report.state).toBe("done");
    expect(report.assets).toBe(0);
    expect(report.spent).toBe(0);
  });
});
