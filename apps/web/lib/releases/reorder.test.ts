import { describe, expect, it } from "vitest";
import { buildSnapshot, type ReleaseInputs } from "./build";
import { fakeBuilder, PROFILE, specFor } from "./fixtures/fake-builder";
import { compareToRelease, inputDifferences, type CurrentState } from "./reorder";

const inputs: ReleaseInputs = {
  specVersion: 3,
  patternBlockId: "jersey-mens",
  patternBlockVersion: 2,
  fabricTestIds: ["test-a"],
  printProfile: PROFILE,
  roster: null,
  files: [specFor("front"), specFor("back")],
};
const now = (over: Partial<CurrentState> = {}): CurrentState => ({
  specVersion: 3,
  patternBlockId: "jersey-mens",
  patternBlockVersion: 2,
  fabricTestIds: ["test-a"],
  printProfile: PROFILE,
  rosterHash: null,
  ...over,
});

describe("a reorder", () => {
  it("rebuilds identical hashes from an untouched release", async () => {
    const snapshot = await buildSnapshot(inputs, fakeBuilder());
    const report = await compareToRelease(snapshot, inputs.files, now(), fakeBuilder());
    expect(report).toEqual({ identical: true, differences: [], files: [{ path: "print/back-48.pdf", status: "same" }, { path: "print/front-48.pdf", status: "same" }] });
  });

  it("reports a fabric test that changed after the release, and the files it changed", async () => {
    const snapshot = await buildSnapshot(inputs, fakeBuilder());
    const report = await compareToRelease(snapshot, inputs.files, now({ fabricTestIds: ["test-b"] }), fakeBuilder("scale changed"));
    expect(report.identical).toBe(false);
    expect(report.differences.map((d) => d.code)).toEqual(["fabric-tests"]);
    expect(report.differences[0]?.message).toContain("test-a");
    expect(report.differences[0]?.message).toContain("test-b");
    expect(report.files.every((f) => f.status === "changed")).toBe(true);
  });

  it("names the print profile field that changed", async () => {
    const snapshot = await buildSnapshot(inputs, fakeBuilder());
    const report = await compareToRelease(snapshot, inputs.files, now({ printProfile: { ...PROFILE, bleedMm: 12 } }), fakeBuilder());
    expect(report.differences).toEqual([{ code: "print-profile", message: "The print profile changed: bleed was 15 and is now 12." }]);
    expect(report.identical).toBe(false);
  });

  it("says when the files differ and no setting explains it", async () => {
    const snapshot = await buildSnapshot(inputs, fakeBuilder());
    const report = await compareToRelease(snapshot, inputs.files, now(), fakeBuilder("new renderer"));
    expect(report.differences.map((d) => d.code)).toEqual(["files-differ"]);
  });

  it("lists a frozen file the settings no longer build", async () => {
    const snapshot = await buildSnapshot(inputs, fakeBuilder());
    const report = await compareToRelease(snapshot, [specFor("front")], now(), fakeBuilder());
    expect(report.files).toEqual([{ path: "print/front-48.pdf", status: "same" }, { path: "print/back-48.pdf", status: "missing" }]);
    expect(report.identical).toBe(false);
  });
});

describe("inputDifferences", () => {
  const frozen = async () => buildSnapshot({ ...inputs, roster: [{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 }], files: [specFor("front")] }, fakeBuilder());
  it("sees a new design version and a new pattern", async () => {
    const snapshot = await frozen();
    expect(inputDifferences(snapshot, now({ specVersion: 4, patternBlockVersion: 3, rosterHash: snapshot.rosterHash })).map((d) => d.code)).toEqual(["design-version", "pattern"]);
    expect(inputDifferences(snapshot, now({ patternBlockId: "other", rosterHash: snapshot.rosterHash })).map((d) => d.code)).toEqual(["pattern"]);
  });
  it("treats the same fabric tests in another order as unchanged", async () => {
    const snapshot = await buildSnapshot({ ...inputs, fabricTestIds: ["b", "a"] }, fakeBuilder());
    expect(inputDifferences(snapshot, now({ fabricTestIds: ["a", "b"] }))).toEqual([]);
  });
  it("says the team list is gone, or changed", async () => {
    const snapshot = await frozen();
    expect(inputDifferences(snapshot, now({ rosterHash: null }))[0]?.message).toContain("no longer there");
    expect(inputDifferences(snapshot, now({ rosterHash: "f".repeat(64) }))[0]?.message).toContain("changed");
  });
  it("describes a setting that was not set", async () => {
    const snapshot = await frozen();
    const diffs = inputDifferences(snapshot, now({ rosterHash: snapshot.rosterHash, printProfile: { ...PROFILE, maxPrintWidthMm: 1500 } }));
    expect(diffs[0]?.message).toBe("The print profile changed: widest print was not set and is now 1500.");
  });
  it("says none when fabric tests were not used, in plain words", async () => {
    const snapshot = await buildSnapshot({ ...inputs, fabricTestIds: [] }, fakeBuilder());
    expect(inputDifferences(snapshot, now({ fabricTestIds: ["x"] }))[0]?.message).toContain("release used none");
  });
});
