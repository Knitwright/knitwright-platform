import { describe, expect, it } from "vitest";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { rosterHash } from "./hash";

describe("rosterHash", () => {
  it("is a SHA-256 in hex", () => {
    expect(rosterHash(ROSTER_22.rows)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("does not depend on the order of the rows", () => {
    expect(rosterHash([...ROSTER_22.rows].reverse())).toBe(rosterHash(ROSTER_22.rows));
  });
  it("changes when a size changes", () => {
    const [first, ...rest] = ROSTER_22.rows;
    expect(rosterHash([{ ...first!, sizeLabel: "S" }, ...rest])).not.toBe(rosterHash(ROSTER_22.rows));
  });
  it("tells apart rows whose cells would run together", () => {
    const a = { name: "AB", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 } as const;
    const b = { ...a, name: "A", sizeLabel: "BM" };
    expect(rosterHash([a])).not.toBe(rosterHash([b]));
  });
});
