import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { OPTION_KINDS, isConstruction } from "./gates";

describe("which options the ambiguity rules guard", () => {
  it("classes every option of every registered type, so a new option is a decision and not an accident", () => {
    const ids = new Set(listTypes().flatMap((type) => type.options.map((option) => option.id)));
    for (const id of ids) expect(Object.keys(OPTION_KINDS)).toContain(id);
  });

  it("guards every option of every family except fit, which is the only style choice", () => {
    const ids = new Set(listTypes().flatMap((type) => type.options.map((option) => option.id)));
    const style = [...ids].filter((id) => !isConstruction(id));
    expect(style).toEqual(["fit"]);
  });

  it("treats fit as style and an unknown option as construction", () => {
    expect(isConstruction("fit")).toBe(false);
    expect(isConstruction("collar")).toBe(true);
    expect(isConstruction("something-new")).toBe(true);
  });
});
