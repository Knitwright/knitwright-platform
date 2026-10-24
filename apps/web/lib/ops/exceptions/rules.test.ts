import { describe, expect, it } from "vitest";
import { checkOwnerAndDue, isOverdue, isRealDate, sortForWork, today } from "./rules";

describe("exception rules", () => {
  it("knows a real date from a made-up one", () => {
    expect(isRealDate("2026-02-28")).toBe(true);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("26-02-28")).toBe(false);
  });

  it("is overdue only when open and past its due date", () => {
    const now = new Date("2026-11-05T09:00:00Z");
    expect(today(now)).toBe("2026-11-05");
    expect(isOverdue({ status: "open", dueOn: "2026-11-05" }, now)).toBe(false);
    expect(isOverdue({ status: "open", dueOn: "2026-11-04" }, now)).toBe(true);
    expect(isOverdue({ status: "resolved", dueOn: "2026-11-04" }, now)).toBe(false);
  });

  it("needs both an owner and a due date", () => {
    expect(checkOwnerAndDue("Sam", "2026-11-05")).toBeNull();
    expect(checkOwnerAndDue("  ", "2026-11-05")).toMatch(/owner/);
    expect(checkOwnerAndDue("x".repeat(81), "2026-11-05")).toMatch(/owner/);
    expect(checkOwnerAndDue("Sam", "soon")).toMatch(/due date/);
  });

  it("sorts open before resolved, then by due date, whatever order they arrive in", () => {
    const list = [
      { id: "c", status: "resolved" as const, dueOn: "2026-01-01" },
      { id: "b", status: "open" as const, dueOn: "2026-11-09" },
      { id: "a", status: "open" as const, dueOn: "2026-11-02" },
      { id: "d", status: "open" as const, dueOn: "2026-11-02" },
    ];
    expect(sortForWork(list).map((e) => e.id)).toEqual(["a", "d", "b", "c"]);
    expect(sortForWork([...list].reverse()).map((e) => e.id)).toEqual(["a", "d", "b", "c"]);
  });
});
