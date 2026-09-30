import { describe, expect, it } from "vitest";
import type { LogEvent } from "@/lib/server/core/guard";
import { loggingAlert, withCeilingHook, type CeilingAlert } from "./alert";

describe("loggingAlert", () => {
  it("writes a warning that names the level, the total and the ceiling in dollars", async () => {
    const logged: LogEvent[] = [];
    const alert = loggingAlert((event) => void logged.push(event));

    await alert({ level: "half", spent: 10_000_000, ceiling: 20_000_000 });
    await alert({ level: "full", spent: 20_000_000, ceiling: 20_000_000 });

    expect(logged).toEqual([
      {
        level: "warn",
        where: "usage",
        message: "AI spend today has reached half the safety ceiling: $10.00 of $20.00.",
      },
      {
        level: "warn",
        where: "usage",
        message:
          "AI spend today has reached the safety ceiling: $20.00 of $20.00. Paid calls are refused until midnight UTC.",
      },
    ]);
  });
});

describe("withCeilingHook", () => {
  it("tells monitoring when the day's ceiling is reached, after the usual alert, and not at half", async () => {
    const calls: string[] = [];
    const hits: unknown[] = [];
    const alert = withCeilingHook(
      async (raised: CeilingAlert) => void calls.push(`alert ${raised.level}`),
      async (hit) => {
        calls.push("ceiling");
        hits.push(hit);
      },
    );

    await alert({ level: "half", spent: 10_000_000, ceiling: 20_000_000 });
    await alert({ level: "full", spent: 20_000_000, ceiling: 20_000_000 });

    expect(calls).toEqual(["alert half", "alert full", "ceiling"]);
    expect(hits).toEqual([{ scope: "total", spentMicros: 20_000_000, ceilingMicros: 20_000_000 }]);
  });
});
