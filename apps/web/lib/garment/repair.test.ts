import { describe, expect, it } from "vitest";
import { migrateSpec, repairSpec, upgradeToCurrent } from "./repair";
import { start } from "./fixtures/specs";
import { validateSpec } from "./spec";

/** A plain copy that a test can change into an out of date stored design. */
const plain = (typeId: string): Record<string, unknown> => JSON.parse(JSON.stringify(start(typeId)));

function staleCrewTee(): Record<string, unknown> {
  const spec = plain("crew-tee");
  const options = spec.options as Record<string, unknown>;
  options.neckline = { choiceId: "v-neck", provenance: "user-edited" };
  options.lining = { choiceId: "silk", provenance: "user-edited" };
  spec.measurements = [
    { pointId: "chest-width", value: 5200, provenance: "user-edited" },
    { pointId: "collar-height", value: 800, provenance: "user-edited" },
  ];
  return spec;
}

describe("repairSpec", () => {
  it("resets a choice that is no longer offered to the type default, marked as derived", () => {
    const stale = migrateSpec(staleCrewTee());
    if (!stale.ok) throw new Error(stale.reason);
    expect(stale.stale).toBe(true);
    const result = repairSpec(stale.spec);
    if (!result.ok) throw new Error(result.reason);
    expect(result.spec.options.neckline).toEqual({ choiceId: "crew", provenance: "derived" });
    expect(result.spec.options).not.toHaveProperty("lining");
    expect(result.spec.measurements.map((entry) => entry.pointId)).toEqual(["chest-width"]);
    expect(result.dropped.map((item) => [item.kind, item.id])).toEqual([
      ["option", "neckline"],
      ["option", "lining"],
      ["measurement", "collar-height"],
    ]);
    expect(validateSpec(result.spec).ok).toBe(true);
  });

  it("leaves a design that is already valid alone", () => {
    const spec = start("polo");
    const result = repairSpec(spec);
    expect(result).toEqual({ ok: true, spec, dropped: [] });
  });

  it("says so when the garment type no longer exists", () => {
    const result = repairSpec({ ...start("polo"), typeId: "kilt" });
    expect(result).toEqual({ ok: false, reason: "There is no garment type called kilt." });
  });
});

describe("migrateSpec", () => {
  it("reads a current design", () => {
    const result = migrateSpec(plain("polo"));
    expect(result.ok && result.stale).toBe(false);
  });

  it("refuses things that are not designs", () => {
    for (const input of [null, 7, "polo", [], {}]) {
      expect(migrateSpec(input)).toEqual({ ok: false, reason: "This is not a saved design." });
    }
  });

  it("refuses an older version with a plain sentence", () => {
    expect(migrateSpec({ ...plain("polo"), schemaVersion: 2 })).toEqual({
      ok: false,
      reason: "This design was saved in an older format, version 2, which can no longer be opened.",
    });
  });

  it("refuses a newer version with a plain sentence", () => {
    expect(migrateSpec({ ...plain("polo"), schemaVersion: 99 })).toEqual({
      ok: false,
      reason: "This design was saved by a newer version of the app, version 99, and cannot be opened here.",
    });
  });

  it("refuses a design whose shape is broken", () => {
    const broken = { ...plain("polo"), measurements: "lots" };
    const result = migrateSpec(broken);
    expect(result.ok).toBe(false);
  });
});

describe("upgradeToCurrent", () => {
  const addNote = (input: Record<string, unknown>): Record<string, unknown> => ({ ...input, note: "added" });

  it("runs each upgrade in turn and stamps the new version", () => {
    const upgrades = { 1: addNote, 2: (input: Record<string, unknown>) => ({ ...input, second: true }) };
    expect(upgradeToCurrent({ schemaVersion: 1 }, upgrades, 3)).toEqual({ schemaVersion: 3, note: "added", second: true });
  });

  it("stops with a sentence when a step has no upgrade, or the version is not a whole number", () => {
    expect(upgradeToCurrent({ schemaVersion: 1 }, {}, 3)).toMatch(/older format, version 1/);
    expect(upgradeToCurrent({ schemaVersion: "1" }, {}, 3)).toBe("This is not a saved design.");
    expect(upgradeToCurrent({ schemaVersion: 1.5 }, {}, 3)).toBe("This is not a saved design.");
  });

  it("leaves a design already at the current version alone", () => {
    const design = { schemaVersion: 3 };
    expect(upgradeToCurrent(design, {}, 3)).toBe(design);
  });
});
