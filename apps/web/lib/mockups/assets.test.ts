import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LaunchAsset, SceneAsset } from "@/lib/launch/assets";
import { CONVERT_HELP, CONVERT_LABEL, GENERATED_REFUSED, convertToImage, drawnAsset, offerable } from "./assets";

/**
 * **THE TEST SPEC DECISION 13 ASKS FOR** (plan v5: "a test proves it where your code could allow
 * it"; decision 0091 point 1).
 *
 * The mockup studio is the deterministic half of F-L1. It calls no model, so it can only ever hand
 * the shell a picture the platform drew. Three things are checked here, and the first two cast past
 * the compiler on purpose, because a panel may be handed a value that came out of the database and
 * the compiler never saw it:
 *
 *   1. a generated picture offered as a mockup is refused;
 *   2. a generated picture offered as a panel layer or a print file is refused as well, which is the
 *      refusal that matters: that is the one that would put a model's pixels on the garment;
 *   3. **nothing in `lib/mockups` or `components/mockups` constructs a generated asset at all** --
 *      the source files are read and searched, so a later change to this workstream that reached for
 *      one would fail here rather than in a review.
 */

const file = { fileId: "11111111-1111-4111-8111-111111111111", contentType: "image/png" } as const;

/** A generated picture, built by casting past the union, exactly as the shell's own test does. */
const generated = (role: string): LaunchAsset =>
  ({ role, provenance: "generated", file, label: "AI-generated", showsPerson: false } as unknown as SceneAsset);

describe("what the mockup studio may hand the shell", () => {
  it("makes a drawn asset in each of the three roles a drawn picture may take", () => {
    for (const role of ["scene", "panel_layer", "print_file"] as const) {
      const made = drawnAsset(file, "deterministic", role);
      expect(made.ok, role).toBe(true);
      if (made.ok) expect(made.asset).toEqual({ role, provenance: "deterministic", file });
    }
  });

  it("makes a golden-sample photograph an asset too, which is the other locked source", () => {
    const made = drawnAsset(file, "golden_sample");
    expect(made.ok && made.asset.provenance).toBe("golden_sample");
  });

  it("Convert to image offers the mockup as scenery, and says what it costs the person", () => {
    const made = convertToImage(file);
    expect(made.ok && made.asset.role).toBe("scene");
    expect(CONVERT_LABEL).toBe("Convert to image");
    expect(CONVERT_HELP).toContain("stop following the design");
  });
});

describe("the garment lock, cast past the compiler", () => {
  it("refuses a generated picture as a mockup", () => {
    const refused = offerable(generated("scene"));
    expect(refused).toEqual({ ok: false, reason: GENERATED_REFUSED });
  });

  it("refuses a generated picture as a layer on the garment or as part of a print file", () => {
    for (const role of ["panel_layer", "print_file"]) {
      const refused = offerable(generated(role));
      expect(refused.ok, role).toBe(false);
      if (!refused.ok) expect(refused.reason).toBe(GENERATED_REFUSED);
    }
  });

  it("passes a drawn picture through the shell's own door as well", () => {
    expect(offerable({ role: "print_file", provenance: "deterministic", file }).ok).toBe(true);
  });
});

describe("the one thing a later change could get wrong", () => {
  const roots = [join(__dirname), join(__dirname, "..", "..", "components", "mockups")];

  const sources = (): readonly string[] =>
    roots.flatMap((root) =>
      readdirSync(root, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
        .map((entry) => join(entry.parentPath, entry.name)),
    );

  it("finds the files it reads", () => {
    expect(sources().length).toBeGreaterThan(10);
  });

  it("never writes down a generated picture anywhere in this workstream", () => {
    const offenders = sources().filter((path) => /provenance:\s*"generated"|"AI-generated"|SceneAsset\s*=|: SceneAsset/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
