import { describe, expect, it } from "vitest";
import { releaseSnapshotSchema } from "@/lib/production/contract";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { rosterHash } from "@/lib/orders/hash";
import { buildSnapshot, filePath, type ReleaseInputs } from "./build";
import { fakeBuilder, PROFILE, specFor } from "./fixtures/fake-builder";

const inputs = (over: Partial<ReleaseInputs> = {}): ReleaseInputs => ({
  specVersion: 3,
  patternBlockId: "jersey-mens",
  patternBlockVersion: 2,
  fabricTestIds: ["test-b", "test-a"],
  printProfile: PROFILE,
  roster: null,
  files: [specFor("front"), specFor("back"), specFor("sleeve")],
  ...over,
});

describe("filePath", () => {
  it("names the piece, the size and the player", () => {
    expect(filePath(specFor("front", "48"))).toBe("print/front-48.pdf");
    expect(filePath(specFor("back", "XL", "10"))).toBe("print/back-XL-player-10.pdf");
  });
  it("keeps odd size labels inside a safe name", () => {
    expect(filePath(specFor("front", "2 XL/../x"))).toBe("print/front-2_XL_.._x.pdf");
  });
});

describe("buildSnapshot", () => {
  it("lists every file with a SHA-256, in path order, and parses as the contract's snapshot", async () => {
    const snapshot = await buildSnapshot(inputs(), fakeBuilder());
    expect(releaseSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.files.map((f) => f.path)).toEqual(["print/back-48.pdf", "print/front-48.pdf", "print/sleeve-48.pdf"]);
    expect(snapshot.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
  });
  it("gives the same snapshot however the inputs are ordered", async () => {
    const a = await buildSnapshot(inputs(), fakeBuilder());
    const b = await buildSnapshot(inputs({ fabricTestIds: ["test-a", "test-b"], files: [...inputs().files].reverse() }), fakeBuilder());
    expect(b).toEqual(a);
  });
  it("keeps a hash of the roster, never the names", async () => {
    const snapshot = await buildSnapshot(inputs({ roster: ROSTER_22.rows }), fakeBuilder());
    expect(snapshot.rosterHash).toBe(rosterHash(ROSTER_22.rows));
    expect(JSON.stringify(snapshot)).not.toContain("OKAFOR");
  });
  it("has no roster hash when there is no team order", async () => {
    expect((await buildSnapshot(inputs(), fakeBuilder())).rosterHash).toBeNull();
  });
  it("refuses two files with one path", async () => {
    await expect(buildSnapshot(inputs({ files: [specFor("front"), specFor("front")] }), fakeBuilder())).rejects.toThrow(/same name/);
  });
  it("refuses a file for a player who is not in the roster", async () => {
    await expect(buildSnapshot(inputs({ roster: ROSTER_22.rows, files: [specFor("back", "XL", "99")] }), fakeBuilder())).rejects.toThrow(/99/);
  });
  it("refuses a player file when there is no roster", async () => {
    await expect(buildSnapshot(inputs({ files: [specFor("back", "XL", "7")] }), fakeBuilder())).rejects.toThrow(/team order/);
  });
  it("builds each file once", async () => {
    const builder = fakeBuilder();
    await buildSnapshot(inputs(), builder);
    expect(builder.built).toHaveLength(3);
  });
});
