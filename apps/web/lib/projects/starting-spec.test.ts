import { describe, expect, it } from "vitest";
import { MADE_UP_CHART_SET } from "@/lib/sizing/fixtures/made-up-charts";
import { startingSpec } from "./starting-spec";

describe("startingSpec", () => {
  it("starts a design with no sizes and no measurements while there are no size charts", () => {
    const result = startingSpec("crew-tee", "women");

    expect(result).toMatchObject({ ok: true, spec: { typeId: "crew-tee", wearer: "women", sizing: null, measurements: [] } });
  });

  it("takes the sizes of the chart when one applies", () => {
    const result = startingSpec("crew-tee", "men", MADE_UP_CHART_SET);

    expect(result).toMatchObject({
      ok: true,
      spec: { sizing: { sizes: ["T1", "T2", "T3", "T4", "T5"], baseSize: "T3" }, measurements: [] },
    });
  });

  it("never makes up a measurement", () => {
    const result = startingSpec("polo", "youth", MADE_UP_CHART_SET);

    expect(result.ok && result.spec.measurements).toEqual([]);
  });

  it("gives a plain reason for a garment type that does not exist", () => {
    expect(startingSpec("no-such-type", "men")).toEqual({
      ok: false,
      reason: "There is no garment type called no-such-type.",
    });
  });
});
