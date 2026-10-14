import { describe, expect, it } from "vitest";
import { JOURNEY_STEPS, journeyStep, type DesignProgress } from "./journey";

const fresh: DesignProgress = { toConfirm: 5, downloaded: false, shared: false, quoted: false };

describe("journeyStep", () => {
  it("names the four steps in order", () => {
    expect(JOURNEY_STEPS.map((step) => step.label)).toEqual(["Design", "Factory file", "Committee", "Quote"]);
  });

  it("is the design step while the factory file has empty fields and nothing else happened", () => {
    expect(journeyStep(fresh)).toBe("design");
  });

  it("is the design step when the count of empty fields is not known", () => {
    expect(journeyStep({ ...fresh, toConfirm: null })).toBe("design");
  });

  it("is the factory file step once nothing is empty, or once the file was downloaded", () => {
    expect(journeyStep({ ...fresh, toConfirm: 0 })).toBe("factory-file");
    expect(journeyStep({ ...fresh, downloaded: true })).toBe("factory-file");
  });

  it("is the committee step once a share link was made", () => {
    expect(journeyStep({ ...fresh, shared: true })).toBe("committee");
  });

  it("is the quote step once a quote was asked for, whatever else is true", () => {
    expect(journeyStep({ ...fresh, shared: true, quoted: true })).toBe("quote");
    expect(journeyStep({ ...fresh, quoted: true })).toBe("quote");
  });
});
