import { describe, expect, it } from "vitest";
import { STATUSES, STATUS_WORDS, canMove, nextStatuses, isOpen } from "./transitions";

describe("pattern request transitions", () => {
  it("moves forward one step at a time", () => {
    expect(canMove("requested", "accepted")).toBe(true);
    expect(canMove("accepted", "in_progress")).toBe(true);
    expect(canMove("in_progress", "delivered")).toBe(true);
  });

  it("lets ops decline until the work is delivered", () => {
    for (const from of ["requested", "accepted", "in_progress"] as const) expect(canMove(from, "declined")).toBe(true);
  });

  it("does not skip steps or go back", () => {
    expect(canMove("requested", "in_progress")).toBe(false);
    expect(canMove("requested", "delivered")).toBe(false);
    expect(canMove("in_progress", "accepted")).toBe(false);
  });

  it("treats delivered and declined as the end", () => {
    for (const to of STATUSES) {
      expect(canMove("delivered", to)).toBe(false);
      expect(canMove("declined", to)).toBe(false);
    }
    expect(nextStatuses("delivered")).toEqual([]);
    expect(isOpen("delivered")).toBe(false);
    expect(isOpen("requested")).toBe(true);
  });

  it("lists the next steps in order", () => {
    expect(nextStatuses("requested")).toEqual(["accepted", "declined"]);
  });

  it("has plain words for every status", () => {
    for (const s of STATUSES) expect(STATUS_WORDS[s].length).toBeGreaterThan(0);
  });
});
