import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { requestForIntent } from "./measurement-request";

const withValue = (): GarmentSpec => {
  const result = applyAction(start("crew-tee"), { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("requestForIntent", () => {
  it("asks to set a measurement the person typed", () => {
    expect(requestForIntent(start("crew-tee"), "chest-width", { kind: "set", tenths: 5250 })).toEqual({
      kind: "action",
      action: { type: "set-measurement", pointId: "chest-width", value: 5250, provenance: "user-edited" },
    });
  });

  it("asks to remove a value the person emptied the field of", () => {
    expect(requestForIntent(withValue(), "chest-width", { kind: "remove" })).toEqual({
      kind: "action",
      action: { type: "remove-measurement", pointId: "chest-width" },
    });
  });

  it("asks for nothing when there is nothing to do", () => {
    expect(requestForIntent(start("crew-tee"), "chest-width", { kind: "none" })).toBeNull();
  });

  it("passes on the reason when the text is not a length", () => {
    expect(requestForIntent(start("crew-tee"), "chest-width", { kind: "invalid", reason: "Enter a length." })).toEqual({
      kind: "problem",
      reason: "Enter a length.",
    });
  });

  it("gives a plain reason for a point that does not apply to the design", () => {
    const request = requestForIntent(start("crew-tee"), "placket-length", { kind: "set", tenths: 1000 });

    expect(request).toMatchObject({ kind: "problem" });
  });

  it("gives a plain reason when there is no value of the person's own to remove", () => {
    expect(requestForIntent(start("crew-tee"), "chest-width", { kind: "remove" })).toMatchObject({ kind: "problem" });
  });
});
