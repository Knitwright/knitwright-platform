import { describe, expect, it } from "vitest";
import { draftConstantsSource } from "./constants";
import {
  masterPatternCheck,
  masterPatternSource,
  mayGoLive,
  NO_MASTER_PATTERNS,
  NO_MASTER_PATTERN_ON_FILE,
  type MasterPattern,
  type MasterPatternCheck,
} from "./master-pattern";

/**
 * Owner decision 10: an article cannot go `live` without a factory-checked master pattern, none
 * exists, and the check says so instead of passing quietly. Wave 3 (Z8) implements the gate; these
 * tests hold the contract X3b writes down.
 */

const SIGNED: MasterPattern = {
  articleCode: "JSY-SS-01",
  size: "M",
  artifactId: "00000000-0000-0000-0000-000000000001",
  signedOff: { name: "A Pattern Master", role: "Pattern master", on: "2026-11-01" },
  seams: [{ label: "Front armhole (one side)", mm: 240 }],
};

const checked = (withinTolerance: boolean): MasterPatternCheck => ({
  kind: "checked",
  articleCode: "JSY-SS-01",
  master: SIGNED,
  deviations: [{ label: "Front armhole (one side)", masterMm: 240, draftedMm: 241, deviationMm: 1, withinTolerance }],
  toleranceMm: 2,
});

describe("the master-pattern check", () => {
  it("reports no master pattern on file for the one article the platform drafts", () => {
    const check = masterPatternCheck("JSY-SS-01");
    expect(check).toMatchObject({ kind: "no-master-pattern-on-file", articleCode: "JSY-SS-01", ruleId: "R-GAP-000" });
    const message = check?.kind === "no-master-pattern-on-file" ? check.message : "";
    expect(message).toContain(NO_MASTER_PATTERN_ON_FILE);
    expect(message).toContain("stays a draft until a factory returns a signed pattern");
  });

  it("takes spec F-S3's 2 mm from the article's drafting constants, not from code", () => {
    expect(masterPatternCheck("JSY-SS-01")?.toleranceMm).toBe(2);
  });

  it("has nothing to say about an article with no drafting constants on file", () => {
    expect(masterPatternCheck("SHO-TR-01")).toBeNull();
    expect(masterPatternCheck("JSY-SS-01", NO_MASTER_PATTERNS, draftConstantsSource({}))).toBeNull();
  });

  it("names the person who signed a master that does arrive, and still says it is unchecked", () => {
    const check = masterPatternCheck("JSY-SS-01", masterPatternSource([SIGNED]));
    expect(check).toMatchObject({ kind: "not-checked-yet", master: SIGNED });
    expect(check?.kind === "not-checked-yet" && check.message).toContain("signed by A Pattern Master, Pattern master, on 2026-11-01");
    expect(masterPatternCheck("SHO-TR-02", masterPatternSource([SIGNED]))).toBeNull();
  });
});

describe("whether an article may go live", () => {
  it("refuses while there is no master pattern, and while one is unchecked", () => {
    expect(mayGoLive(masterPatternCheck("JSY-SS-01"))).toBe(false);
    expect(mayGoLive(masterPatternCheck("JSY-SS-01", masterPatternSource([SIGNED])))).toBe(false);
    expect(mayGoLive(null)).toBe(false);
  });

  it("allows it only once every seam of a checked master is inside the tolerance", () => {
    expect(mayGoLive(checked(true))).toBe(true);
    expect(mayGoLive(checked(false))).toBe(false);
    expect(mayGoLive({ kind: "checked", articleCode: "JSY-SS-01", master: SIGNED, deviations: [], toleranceMm: 2 })).toBe(false);
  });
});
