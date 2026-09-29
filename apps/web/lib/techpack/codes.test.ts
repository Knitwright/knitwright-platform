import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { calloutCodes, codeFor } from "./codes";

describe("codeFor", () => {
  it("counts A to Z, then AA, AB and on", () => {
    expect(codeFor(0)).toBe("A");
    expect(codeFor(1)).toBe("B");
    expect(codeFor(25)).toBe("Z");
    expect(codeFor(26)).toBe("AA");
    expect(codeFor(27)).toBe("AB");
    expect(codeFor(51)).toBe("AZ");
    expect(codeFor(52)).toBe("BA");
  });

  it("never gives the same code twice in the first 700", () => {
    const codes = Array.from({ length: 700 }, (_, index) => codeFor(index));
    expect(new Set(codes).size).toBe(700);
  });
});

describe("calloutCodes", () => {
  it("gives a code to each point of measure in registry order", () => {
    const codes = calloutCodes(start("crew-tee"));
    expect(codes.slice(0, 3)).toEqual([
      { pointId: "chest-width", code: "A", label: "Chest width" },
      { pointId: "body-length", code: "B", label: "Body length" },
      { pointId: "shoulder-width", code: "C", label: "Shoulder width" },
    ]);
    expect(codes.map((entry) => entry.code)).toEqual("ABCDEFGHIJK".split(""));
  });

  it("leaves out points the design does not have, so the codes stay in step with the table", () => {
    const codes = calloutCodes(start("polo"));
    expect(codes.some((entry) => entry.pointId === "placket-length")).toBe(true);
    expect(calloutCodes(start("crew-tee")).some((entry) => entry.pointId === "placket-length")).toBe(false);
  });

  it("gives nothing for an unknown type", () => {
    expect(calloutCodes({ ...start("crew-tee"), typeId: "kilt" })).toEqual([]);
  });
});
