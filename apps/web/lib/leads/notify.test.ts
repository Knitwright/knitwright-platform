import { describe, expect, it } from "vitest";
import type { LogEvent } from "@/lib/server/core/guard";
import { loggingQuoteNotifier } from "./notify";

describe("loggingQuoteNotifier", () => {
  it("writes one info line naming the request, with no personal details", async () => {
    const lines: LogEvent[] = [];
    const notify = loggingQuoteNotifier((event) => lines.push(event));

    await notify({ quoteId: "q-1", brandId: "b-1", projectId: "p-1", version: 3, quantity: 120, neededBy: "2026-12-01" });

    expect(lines).toEqual([
      {
        level: "info",
        where: "quote-request",
        message: "New quote request q-1: brand b-1, design p-1 version 3, 120 pieces by 2026-12-01. See /admin/leads.",
      },
    ]);
  });
});
