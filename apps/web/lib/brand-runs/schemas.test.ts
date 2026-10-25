import { describe, expect, it } from "vitest";
import { productBody, runBody, stageBody } from "./schemas";

const ID = "6f1c1b0e-7a52-4b53-9a53-0d6f1a3c9d11";
const run = { productId: ID, kind: "run", releaseId: ID, fabricKey: "mesh", quantities: { M: 10 }, requestKey: "abcdefgh" };

describe("brand run bodies", () => {
  it("trims a product name and refuses an empty one", () => {
    expect(productBody.parse({ projectId: ID, name: "  Hoodie  " }).name).toBe("Hoodie");
    expect(productBody.safeParse({ projectId: ID, name: "   " }).success).toBe(false);
    expect(productBody.safeParse({ projectId: "x", name: "A" }).success).toBe(false);
  });
  it("takes only the three stages", () => {
    expect(stageBody.safeParse({ productId: ID, to: "run" }).success).toBe(true);
    expect(stageBody.safeParse({ productId: ID, to: "shipped" }).success).toBe(false);
  });
  it("reads a run and defaults the acknowledgement to no", () => {
    expect(runBody.parse(run).acknowledgeFlags).toBe(false);
  });
  it("refuses a short request key, a missing fabric and too many sizes", () => {
    expect(runBody.safeParse({ ...run, requestKey: "short" }).success).toBe(false);
    expect(runBody.safeParse({ ...run, fabricKey: " " }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`S${i}`, 1]));
    expect(runBody.safeParse({ ...run, quantities: many }).success).toBe(false);
  });
});
