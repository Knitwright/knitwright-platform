import { describe, expect, it } from "vitest";
import { createSpec } from "@/lib/garment";
import { specFromSnapshot } from "./copy";

const base = () => {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
};

describe("copying a template's design into a new design", () => {
  it("gives a deep copy, so changing the copy never changes the template", () => {
    const snapshot = base();
    const frozen = structuredClone(snapshot);
    const copy = specFromSnapshot(snapshot);
    if (!copy.ok) throw new Error(copy.reason);
    expect(copy.spec).toEqual(frozen);
    expect(copy.spec).not.toBe(snapshot);
    expect(copy.spec.colourways).not.toBe(snapshot.colourways);
    expect(copy.spec.colourways[0]).not.toBe(snapshot.colourways[0]);
    expect(copy.spec.fabrics[0]).not.toBe(snapshot.fabrics[0]);
  });

  it("copies from the stored JSON, not from an object it shares", () => {
    const stored = JSON.parse(JSON.stringify(base())) as Record<string, unknown>;
    const copy = specFromSnapshot(stored);
    if (!copy.ok) throw new Error(copy.reason);
    expect(copy.spec.colourways[0]).not.toBe((stored.colourways as unknown[])[0]);
    expect(copy.spec.options).not.toBe(stored.options);
  });

  it("refuses a snapshot that is not a design, with a plain reason", () => {
    const copy = specFromSnapshot({ typeId: "crew-tee" });
    expect(copy.ok).toBe(false);
    expect(specFromSnapshot(null).ok).toBe(false);
  });

  it("refuses a design on a garment the registry no longer has", () => {
    const stored = { ...base(), typeId: "no-such-garment" };
    expect(specFromSnapshot(stored).ok).toBe(false);
  });
});
