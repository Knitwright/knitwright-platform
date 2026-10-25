import { describe, expect, it } from "vitest";
import { SPEC_TARGET, createStopwatch, describeRun } from "./timing";

const clock = (...times: number[]) => {
  const queue = [...times];
  return () => queue.shift() ?? 0;
};

describe("the stopwatch", () => {
  it("records each step with the time since the one before it", () => {
    const watch = createStopwatch(clock(1000, 1400, 3400, 3500));
    watch.mark("start");
    watch.mark("set ready");
    watch.mark("credits used");
    expect(watch.report("stub", ["clip skipped: no lifestyle picture"])).toEqual({
      providers: "stub",
      steps: [
        { name: "set ready", ms: 400 },
        { name: "credits used", ms: 2000 },
      ],
      totalMs: 2400,
      skipped: ["clip skipped: no lifestyle picture"],
      target: SPEC_TARGET,
    });
  });

  it("reports an empty run as zero", () => {
    expect(createStopwatch(clock()).report("stub", []).totalMs).toBe(0);
  });
});

describe("the spec target", () => {
  it("is 4 images and 1 clip in under 3 minutes, and unmeasured", () => {
    expect(SPEC_TARGET).toMatchObject({ statement: "4 images and 1 clip in under 3 minutes", limitSeconds: 180, status: "unmeasured" });
  });
});

describe("describeRun", () => {
  const report = createStopwatch(clock(0, 1000, 2500)).report("stub", ["clip skipped: no lifestyle picture"]);

  it("lists the steps and says the target is unmeasured", () => {
    const text = describeRun(report);
    expect(text).toMatch(/stub/);
    expect(text).toMatch(/unmeasured/i);
    expect(text).toMatch(/clip skipped/);
  });

  it("never says the target was met or missed, however fast the run", () => {
    const fast = describeRun({ ...report, totalMs: 10 });
    const slow = describeRun({ ...report, totalMs: 10 * 60 * 1000 });
    for (const text of [fast, slow]) expect(text).not.toMatch(/\b(met|missed|within|exceeded|achieved|under target|over target)\b/i);
  });
});
