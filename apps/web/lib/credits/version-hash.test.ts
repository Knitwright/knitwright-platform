import { describe, expect, it } from "vitest";
import { designVersionHash } from "./version-hash";

const PROJECT = "00000000-0000-4000-8000-000000000001";

describe("designVersionHash", () => {
  it("is the same for the same design and version", () => {
    expect(designVersionHash(PROJECT, 3)).toBe(designVersionHash(PROJECT, 3));
  });

  it("differs by version and by design, and fits the ledger's 200 characters", () => {
    const hashes = new Set([
      designVersionHash(PROJECT, 1),
      designVersionHash(PROJECT, 2),
      designVersionHash("00000000-0000-4000-8000-000000000002", 1),
    ]);
    expect(hashes.size).toBe(3);
    expect(designVersionHash(PROJECT, 1)).toMatch(/^[0-9a-f]{64}$/);
  });
});
