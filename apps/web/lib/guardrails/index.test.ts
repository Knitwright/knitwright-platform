import { describe, expect, it } from "vitest";
import { typicalInput, item } from "./fixtures";
import { runGuardrails } from "./index";

describe("runGuardrails", () => {
  it("is deterministic and puts blockers first", () => {
    const input = typicalInput();
    const withBad = { ...input, items: [...input.items, item({ id: "bad", kind: "number", box: { x0: -50, y0: 100, x1: 100, y1: 200 } })] };
    const a = runGuardrails(withBad);
    expect(runGuardrails(withBad)).toEqual(a);
    expect(a[0]?.severity).toBe("blocker");
    expect(a.map((f) => f.severity)).toEqual([...a.map((f) => f.severity)].sort());
  });

  it("covers every check on one design", () => {
    const input = { ...typicalInput(), colours: [{ id: "n", label: "Neon", hex: "#00ff00" }] };
    const codes = new Set(runGuardrails(input).map((f) => f.code));
    expect(codes).toContain("gamut-approx");
    expect(codes).toContain("min-dpi");
  });

  it("runs in under 20 ms for a typical design (6 panels of 200 points, 5 items)", () => {
    const input = typicalInput();
    runGuardrails(input); // warm up
    const runs = Array.from({ length: 20 }, () => {
      const start = performance.now();
      runGuardrails(input);
      return performance.now() - start;
    }).sort((x, y) => x - y);
    expect(runs[Math.floor(runs.length / 2)]).toBeLessThan(20);
  });
});
