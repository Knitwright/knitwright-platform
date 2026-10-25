import { describe, expect, it } from "vitest";
import type { RosterRow } from "@/lib/production/contract";
import type { Player } from "../roster";
import { planReorder } from "./plan";
import { resolveLines } from "./resolve";

const player = (name: string, number: string, sizeLabel: string): Player => ({ name, number, sizeLabel, wearerGroup: "mens" });
const row = (name: string, number: string, sizeLabel: string): RosterRow => ({ name, number, sizeLabel, cut: "mens", quantity: 1 });
const RUN = ["S", "M", "L"];

describe("resolveLines", () => {
  it("needs no answers when nothing needs fixing", () => {
    const plan = planReorder({ players: [player("Ana", "10", "M")], previous: null, run: RUN });
    expect(resolveLines(plan, [])).toEqual({ ok: true, rows: [row("Ana", "10", "M")], leftOut: 0 });
  });

  it("reports every unresolved line by index and makes no rows", () => {
    const plan = planReorder({ players: [player("Ana", "10", "XL"), player("Bo", "", "M")], previous: [row("Cy", "12", "S")], run: RUN });
    expect(resolveLines(plan, [])).toEqual({ ok: false, unresolved: [0, 1, 2] });
  });

  it("accepts a size from the run for a removed size", () => {
    const plan = planReorder({ players: [player("Ana", "10", "XL")], previous: null, run: RUN });
    expect(resolveLines(plan, [{ index: 0, sizeLabel: "L" }])).toMatchObject({ ok: true, rows: [{ sizeLabel: "L" }] });
    expect(resolveLines(plan, [{ index: 0, sizeLabel: "XL" }])).toEqual({ ok: false, unresolved: [0] });
    expect(resolveLines(plan, [{ index: 0, sizeLabel: "XXL" }])).toEqual({ ok: false, unresolved: [0] });
  });

  it("accepts a number for a missing one, and only a valid one", () => {
    const plan = planReorder({ players: [player("Bo", "", "M")], previous: null, run: RUN });
    expect(resolveLines(plan, [{ index: 0, number: "9" }])).toMatchObject({ ok: true, rows: [{ number: "9" }] });
    expect(resolveLines(plan, [{ index: 0, number: "ten" }])).toEqual({ ok: false, unresolved: [0] });
  });

  it("keeps or leaves out a player who left", () => {
    const plan = planReorder({ players: [player("Ana", "10", "M")], previous: [row("Ana", "10", "M"), row("Cy", "12", "S")], run: RUN });
    expect(resolveLines(plan, [{ index: 1, action: "keep" }])).toMatchObject({ ok: true, rows: [{ name: "Ana" }, { name: "Cy" }], leftOut: 0 });
    expect(resolveLines(plan, [{ index: 1, action: "leave-out" }])).toMatchObject({ ok: true, rows: [{ name: "Ana" }], leftOut: 1 });
  });

  it("a left player whose size is gone also needs a size when kept", () => {
    const plan = planReorder({ players: [], previous: [row("Cy", "12", "XXL")], run: RUN });
    expect(resolveLines(plan, [{ index: 0, action: "keep" }])).toEqual({ ok: false, unresolved: [0] });
    expect(resolveLines(plan, [{ index: 0, action: "keep", sizeLabel: "S" }])).toMatchObject({ ok: true, rows: [{ sizeLabel: "S" }] });
  });

  it("leaving a line out settles it whatever its problems", () => {
    const plan = planReorder({ players: [player("Ana", "", "XL")], previous: null, run: RUN });
    expect(resolveLines(plan, [{ index: 0, action: "leave-out" }])).toEqual({ ok: true, rows: [], leftOut: 1 });
  });

  it("ignores an answer for a line that does not exist and does not change the plan", () => {
    const plan = planReorder({ players: [player("Ana", "10", "M")], previous: null, run: RUN });
    const before = JSON.stringify(plan);
    expect(resolveLines(plan, [{ index: 5, action: "leave-out" }])).toMatchObject({ ok: true, rows: [row("Ana", "10", "M")] });
    expect(JSON.stringify(plan)).toBe(before);
  });
});
