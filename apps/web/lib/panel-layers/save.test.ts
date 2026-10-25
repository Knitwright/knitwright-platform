import { describe, expect, it } from "vitest";
import { currentStack } from "@/lib/artwork-stack";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { addTextLayer } from "./edit";
import { FIXTURE_STACK } from "./fixtures/stack";
import { designWithStack } from "./save";

describe("saving a stack as the next version of a design", () => {
  it("stores the stack with the older fields set from it, so the flats and tech pack keep working", () => {
    const spec = jersey();
    const result = designWithStack(spec, FIXTURE_STACK, 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.artworkStack?.derivedFrom).toEqual({ specVersion: 4 });
    expect(result.spec.artworkStack?.layers.map((l) => l.id)).toEqual(FIXTURE_STACK.layers.map((l) => l.id));
    expect(currentStack(result.spec).layers.map((l) => l.id)).toEqual(FIXTURE_STACK.layers.map((l) => l.id));
    expect(spec.artworkStack).toBeUndefined();
  });

  it("reads a stack sent as plain JSON and refuses one that is not valid, with a sentence", () => {
    const sent = JSON.parse(JSON.stringify(FIXTURE_STACK)) as unknown;
    expect(designWithStack(jersey(), sent, 1).ok).toBe(true);
    const bad = designWithStack(jersey(), { ...(sent as object), layers: "no" }, 1);
    expect(bad.ok).toBe(false);
    const newer = designWithStack(jersey(), { ...(sent as object), schemaVersion: 2 }, 1);
    expect(newer).toMatchObject({ ok: false, reason: expect.stringContaining("newer version") });
  });

  it("refuses a design the garment rules would not accept", () => {
    const spec = { ...jersey(), typeId: "not-a-garment" };
    expect(designWithStack(spec, FIXTURE_STACK, 1).ok).toBe(false);
  });
});

describe("what the prototype saves from a design that has no stack yet", () => {
  it("works out the stack, adds text, and saves it so that reading the design again shows the text", () => {
    const spec = jersey();
    const next = designWithStack(spec, addTextLayer(currentStack(spec), "front", "Your text"), 1);
    expect(next).toMatchObject({ ok: true });
    if (!next.ok) return;
    expect(currentStack(next.spec).layers.map((l) => l.id)).toContain("text-1");
    // A text with no panel anchor lives only in the stack (decision 0035), so the older list is as it was.
    expect(next.spec.artwork).toEqual(spec.artwork);
  });
});
