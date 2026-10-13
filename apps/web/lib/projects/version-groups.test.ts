import { describe, expect, it } from "vitest";
import {
  EDIT_GROUP_WINDOW_MS,
  groupNote,
  groupTitle,
  groupVersions,
  revisionNote,
  type GroupableVersion,
} from "./version-groups";

const AMY = "0b7c1f7e-5a43-4c1e-9b1a-1f0a9c3e2d11";
const BEN = "4d2e8a90-7b6c-4f3d-8e21-6a5b4c3d2e1f";
const START = Date.parse("2026-10-13T09:00:00Z");

/** A version saved `seconds` after nine o'clock. */
const at = (version: number, seconds: number, extra: Partial<GroupableVersion> = {}): GroupableVersion => ({
  version,
  note: `Change ${version}.`,
  restoredFrom: null,
  createdAt: new Date(START + seconds * 1000).toISOString(),
  createdBy: AMY,
  ...extra,
});

const shape = (versions: readonly GroupableVersion[]): number[][] =>
  groupVersions(versions).map((group) => group.versions.map((entry) => entry.version));

describe("grouping a run of quick edits into one entry", () => {
  it("is two minutes", () => {
    expect(EDIT_GROUP_WINDOW_MS).toBe(120_000);
  });

  it("puts edits by one person, each within two minutes of the last, together, newest first", () => {
    const versions = [at(1, 0), at(2, 30), at(3, 60), at(4, 100), at(5, 200)];
    expect(shape(versions)).toEqual([[5, 4, 3, 2], [1]]);
  });

  it("reads the versions in any order", () => {
    expect(shape([at(3, 60), at(1, 0), at(2, 30)])).toEqual([[3, 2], [1]]);
  });

  it("keeps the first version on its own: it is where the design started", () => {
    expect(shape([at(1, 0), at(2, 5)])).toEqual([[2], [1]]);
  });

  it("starts a new entry after a pause of more than two minutes", () => {
    expect(shape([at(2, 0), at(3, 120), at(4, 241)])).toEqual([[4], [3, 2]]);
  });

  it("starts a new entry when someone else made the change", () => {
    expect(shape([at(2, 0), at(3, 10, { createdBy: BEN }), at(4, 20, { createdBy: BEN })])).toEqual([[4, 3], [2]]);
  });

  it("never groups a change whose maker is not known", () => {
    expect(shape([at(2, 0, { createdBy: null }), at(3, 10, { createdBy: null })])).toEqual([[3], [2]]);
    expect(shape([at(2, 0, { createdBy: undefined }), at(3, 10, { createdBy: undefined })])).toEqual([[3], [2]]);
  });

  it("keeps a restore or an undo on its own, so going back is always one entry", () => {
    expect(shape([at(2, 0), at(3, 10, { restoredFrom: 1 }), at(4, 20)])).toEqual([[4], [3], [2]]);
  });

  it("does not join versions with a gap between them, such as when the list was cut short", () => {
    expect(shape([at(2, 0), at(4, 10)])).toEqual([[4], [2]]);
  });

  it("does not join a version that is dated after the one that follows it", () => {
    expect(shape([at(2, 50), at(3, 10)])).toEqual([[3], [2]]);
  });

  it("returns nothing for no versions", () => {
    expect(groupVersions([])).toEqual([]);
  });
});

describe("the words for a group", () => {
  it("names one version, or the first and last of several", () => {
    const [many, one] = groupVersions([at(1, 0), at(2, 5), at(3, 10)]);
    expect(groupTitle(many)).toBe("Versions 2 to 3");
    expect(groupTitle(one)).toBe("Version 1");
  });

  it("keeps the note of a single change, and counts the changes of a group", () => {
    const [many, one] = groupVersions([at(1, 0), at(2, 5), at(3, 10)]);
    expect(groupNote(one)).toBe("Change 1.");
    expect(groupNote(many)).toBe("2 changes in a row. The last: Change 3.");
  });

  it("words a revision of the tech pack with the versions it covers", () => {
    const [many, one] = groupVersions([at(1, 0), at(2, 5), at(3, 10)]);
    expect(revisionNote(one)).toBe("Change 1.");
    expect(revisionNote(many)).toBe("Versions 2 to 3. The last change: Change 3.");
    const [long] = groupVersions([at(2, 0), at(3, 5, { note: "y".repeat(200) })]);
    expect(revisionNote(long).length).toBeLessThanOrEqual(200);
  });

  it("stays within the length a version note may have", () => {
    const long = "x".repeat(200);
    const [group] = groupVersions([at(2, 0), at(3, 5, { note: long })]);
    expect(groupNote(group).length).toBeLessThanOrEqual(200);
    expect(groupNote(group).endsWith("...")).toBe(true);
  });
});
