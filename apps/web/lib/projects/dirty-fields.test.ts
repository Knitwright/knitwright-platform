import { describe, expect, it } from "vitest";
import { anyDirty, markDirty } from "./dirty-fields";

describe("markDirty", () => {
  it("hands back the same record when nothing changes, so the screen does not draw again", () => {
    const none = {};
    expect(markDirty(none, "sizes", false)).toBe(none);

    const one = markDirty(none, "sizes", true);
    expect(markDirty(one, "sizes", true)).toBe(one);
  });

  it("keeps only the fields with unsaved text", () => {
    const both = markDirty(markDirty({}, "sizes", true), "colour:collar", true);
    expect(both).toEqual({ sizes: true, "colour:collar": true });
    expect(anyDirty(both)).toBe(true);

    const cleared = markDirty(markDirty(both, "sizes", false), "colour:collar", false);
    expect(cleared).toEqual({});
    expect(anyDirty(cleared)).toBe(false);
  });

  it("settles after one change however often a field reports the same state", () => {
    // A field that reports itself on every draw: the first report changes the record, the rest do not.
    let fields = {};
    let changes = 0;
    for (let draw = 0; draw < 100; draw += 1) {
      const next = markDirty(fields, "sizes", false);
      if (next !== fields) changes += 1;
      fields = next;
    }
    expect(changes).toBe(0);
  });
});
