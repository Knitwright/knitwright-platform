import { describe, expect, it } from "vitest";
import { WEARERS } from "@/lib/garment";
import { WEARER_OPTIONS, wearerLabel } from "./wearers";

describe("wearerLabel", () => {
  it("starts with a capital letter", () => {
    expect([wearerLabel("men"), wearerLabel("women"), wearerLabel("youth")]).toEqual(["Men", "Women", "Youth"]);
  });
});

describe("WEARER_OPTIONS", () => {
  it("has a plain label for every wearer the contract knows, in its order", () => {
    expect(WEARER_OPTIONS.map((option) => option.id)).toEqual([...WEARERS]);
    expect(WEARER_OPTIONS.every((option) => /^[A-Z][a-z]+$/.test(option.label))).toBe(true);
  });
});
