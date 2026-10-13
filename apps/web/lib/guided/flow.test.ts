import { describe, expect, it } from "vitest";
import {
  DEFAULT_START,
  GUIDED_STEPS,
  guideAddress,
  neighbours,
  startFromSentence,
  startLead,
  startMethodFrom,
  stepFrom,
  suggestedName,
} from "./flow";

describe("the steps of the guided flow", () => {
  it("is one path: start, review, adjust, download", () => {
    expect(GUIDED_STEPS.map((step) => step.id)).toEqual(["start", "review", "adjust", "download"]);
    expect(GUIDED_STEPS.every((step) => step.label.length > 0 && step.hint.length > 0)).toBe(true);
  });

  it("reads the step from the address, and starts at the start for anything else", () => {
    expect(stepFrom("review")).toBe("review");
    expect(stepFrom("download")).toBe("download");
    expect(stepFrom(undefined)).toBe("start");
    expect(stepFrom("admin")).toBe("start");
    expect(stepFrom(["adjust"])).toBe("start");
  });

  it("says above the assistant only what it knows of how the design started", () => {
    expect(startLead("text", "a slim polo", 0)).toMatch(/^Your words were sent/);
    expect(startLead("text", undefined, 2)).toMatch(/^Your conversation with the assistant so far is below/);
    expect(startLead("picker", undefined, 2)).toMatch(/^Your conversation with the assistant so far is below/);
    for (const from of ["text", "picker"] as const) {
      expect(startLead(from, undefined, 0)).toBe("Describe anything you want to change, or go on to review.");
    }
    for (const lead of [startLead("text", "x", 0), startLead("text", undefined, 1), startLead("picker", undefined, 0)]) {
      expect(lead).not.toMatch(/picked the garment/);
    }
  });

  it("knows the step before and after each one", () => {
    expect(neighbours("start")).toEqual({ previous: null, next: "review" });
    expect(neighbours("adjust")).toEqual({ previous: "review", next: "download" });
    expect(neighbours("download")).toEqual({ previous: "adjust", next: null });
  });

  it("reads how the person started, and a garment picker for anything else", () => {
    expect(startMethodFrom("text")).toBe("text");
    expect(startMethodFrom("sketch")).toBe("sketch");
    expect(startMethodFrom("picker")).toBe("picker");
    expect(startMethodFrom("other")).toBe("picker");
  });

  it("builds the address of a step, keeping the unit and the sentence to send", () => {
    const id = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
    expect(guideAddress(id, "review")).toBe(`/studio/${id}/guide?step=review`);
    expect(guideAddress(id, "start", { from: "text", say: "a polo, slim fit & navy", unit: "in" })).toBe(
      `/studio/${id}/guide?step=start&from=text&say=a+polo%2C+slim+fit+%26+navy&unit=in`,
    );
  });
});

describe("starting from a sentence", () => {
  it("starts from the garment and wearer the sentence names", () => {
    expect(startFromSentence("A slim polo shirt for women in navy")).toEqual({ typeId: "polo", wearer: "women" });
    expect(startFromSentence("joggers for kids with cuffs")).toEqual({ typeId: "joggers", wearer: "youth" });
  });

  it("starts from a crew neck tee for men when the sentence names neither", () => {
    expect(DEFAULT_START).toEqual({ typeId: "crew-tee", wearer: "men" });
    expect(startFromSentence("something for our running club")).toEqual(DEFAULT_START);
  });

  it("ignores a garment the person refuses, and one of two named garments is not guessed", () => {
    expect(startFromSentence("not a hoodie, a track jacket")).toEqual({ typeId: "track-jacket", wearer: "men" });
    expect(startFromSentence("a polo or a track jacket")).toEqual(DEFAULT_START);
  });

  it("names a new design after its garment", () => {
    expect(suggestedName("polo")).toBe("New polo shirt");
    expect(suggestedName("unknown-type")).toBe("New design");
  });
});
