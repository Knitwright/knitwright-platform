import { describe, expect, it } from "vitest";
import { acceptAsset, assetLabel, GENERATED_LABEL, GENERATED_PERSON_LABEL, type LaunchAsset, type SceneAsset } from "./index";

/**
 * The proof that AI never draws the garment (spec decision 13). The type system shuts the door
 * first -- a generated asset has no role but "scene" -- and these tests shut it again at runtime,
 * because a value read from the database or handed over by a service was never seen by the
 * compiler.
 */

const file = { fileId: "file-1", contentType: "image/png" };

const generated = (showsPerson = false): SceneAsset => ({ role: "scene", provenance: "generated", file, label: GENERATED_LABEL, showsPerson });

const drawn = (role: LaunchAsset["role"]): LaunchAsset => ({ role, provenance: "deterministic", file });

describe("a generated picture", () => {
  it("is taken by an AI board as scenery", () => {
    expect(acceptAsset("ai_image", generated())).toEqual({ accepted: true, role: "asset" });
    expect(acceptAsset("ai_video", generated())).toEqual({ accepted: true, role: "asset" });
  });

  it("is refused by every board the platform draws itself", () => {
    for (const kind of ["design", "artboard", "mockup", "marketing", "info_card"] as const) {
      const verdict = acceptAsset(kind, generated());
      expect(verdict.accepted).toBe(false);
      expect(verdict.accepted === false && verdict.ruleId).toBe("R-GAP-000");
    }
  });

  it("can never be recorded as a layer on the garment or as part of a print file", () => {
    // The cast is the only way to write this at all: the union has no such asset. It stands for a
    // row or a service answer the compiler never checked.
    for (const role of ["panel_layer", "print_file"] as const) {
      const smuggled = { ...generated(), role } as unknown as LaunchAsset;
      const verdict = acceptAsset("ai_image", smuggled);
      expect(verdict.accepted).toBe(false);
      expect(verdict.accepted === false && verdict.reason).toMatch(/never becomes a layer/);
    }
  });

  it("carries the label the spec puts on anything a model made, and the stricter one for a person", () => {
    expect(assetLabel(generated())).toBe(GENERATED_LABEL);
    expect(assetLabel(generated(true))).toBe(GENERATED_PERSON_LABEL);
  });
});

describe("a picture the platform drew", () => {
  it("is taken by the boards the platform draws, in any of the three roles", () => {
    expect(acceptAsset("mockup", drawn("scene"))).toEqual({ accepted: true, role: "asset" });
    expect(acceptAsset("mockup", drawn("panel_layer"))).toEqual({ accepted: true, role: "panel_layer" });
    expect(acceptAsset("design", drawn("print_file"))).toEqual({ accepted: true, role: "print_file" });
  });

  it("is taken from a signed-off golden sample photograph too", () => {
    expect(acceptAsset("mockup", { role: "scene", provenance: "golden_sample", file })).toEqual({ accepted: true, role: "asset" });
  });

  it("is refused by an AI board, which holds what the model produced", () => {
    const verdict = acceptAsset("ai_image", drawn("scene"));
    expect(verdict.accepted).toBe(false);
    expect(verdict.accepted === false && verdict.reason).toMatch(/what the model produced/);
  });

  it("carries no label, because nothing about it was generated", () => {
    expect(assetLabel(drawn("scene"))).toBeNull();
  });
});
