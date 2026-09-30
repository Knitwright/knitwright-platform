import { describe, expect, it } from "vitest";
import type { LogEvent } from "@/lib/server/core/guard";
import { createSpendAlert, logAndReport } from "./wire";

const collect = () => {
  const logged: LogEvent[] = [];
  const reported: LogEvent[] = [];
  const scheduled: (() => Promise<void>)[] = [];
  return {
    logged,
    reported,
    scheduled,
    log: (event: LogEvent) => void logged.push(event),
    report: async (event: LogEvent) => void reported.push(event),
    schedule: (work: () => Promise<void>) => void scheduled.push(work),
  };
};

describe("logAndReport", () => {
  it("logs every event and sends errors to monitoring after the response", async () => {
    const parts = collect();
    const log = logAndReport(parts);
    const failure: LogEvent = { level: "error", message: "Unexpected failure in a handler", where: "GET /x" };

    log(failure);
    expect(parts.logged).toEqual([failure]);
    expect(parts.reported).toEqual([]);

    await parts.scheduled[0]();
    expect(parts.reported).toEqual([failure]);
  });

  it("does not send warnings", () => {
    const parts = collect();
    logAndReport(parts)({ level: "warn", message: "slow", where: "x" });
    expect(parts.logged).toHaveLength(1);
    expect(parts.scheduled).toEqual([]);
  });

  it("sends at once when there is no request to wait for", async () => {
    const parts = collect();
    const log = logAndReport({
      ...parts,
      schedule: () => {
        throw new Error("`after` was called outside a request scope");
      },
    });
    log({ level: "error", message: "m", where: "w" });
    await Promise.resolve();
    expect(parts.reported).toHaveLength(1);
  });
});

describe("createSpendAlert", () => {
  it("logs at error level and reports, naming the scope and the amounts", async () => {
    const parts = collect();
    const alert = createSpendAlert(parts);

    await alert({ scope: "total", spentMicros: 5_000_000, ceilingMicros: 5_000_000 });

    const expected = {
      level: "error",
      message: "AI spend ceiling reached: total spent 5000000 of 5000000 microdollars",
      where: "spend-ceiling",
    };
    expect(parts.logged).toEqual([expected]);
    expect(parts.reported).toEqual([expected]);
  });

  it("names the user or brand without anything that identifies a person", async () => {
    const parts = collect();
    await createSpendAlert(parts)({ scope: "brand", spentMicros: 7, ceilingMicros: 5, subjectId: "b-1" });
    expect(parts.logged[0].message).toBe("AI spend ceiling reached: brand b-1 spent 7 of 5 microdollars");
  });
});
