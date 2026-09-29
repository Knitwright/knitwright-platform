import { describe, expect, it } from "vitest";
import type { LogEvent } from "@/lib/server/core/guard";
import { loggingAlert } from "./alert";

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
