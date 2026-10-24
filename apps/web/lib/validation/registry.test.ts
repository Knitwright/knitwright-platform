import { describe, expect, it } from "vitest";
import { createCheckRegistry } from "./registry";
import { doubleModule } from "./testing";

describe("the check registry", () => {
  it("adds a module without changing the registry it came from", () => {
    const empty = createCheckRegistry();
    const one = empty.register(doubleModule("dpi"));
    expect(empty.modules).toHaveLength(0);
    expect(one.modules.map((m) => m.id)).toEqual(["dpi"]);
  });

  it("refuses two modules with one id", () => {
    expect(() => createCheckRegistry([doubleModule("dpi")]).register(doubleModule("dpi"))).toThrow(/already registered/);
  });
});
