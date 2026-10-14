import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { buildSnapshot } from "@/lib/releases/build";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { AppError } from "@/lib/server/core/errors";
import { gradedJersey } from "../fixtures/graded";
import { PROFILE, specOf } from "../fixtures/real";
import { DEFAULT_PRINT_PROFILE } from "../profiles";
import type { PrintContext } from "./context";
import { PATTERN_NOT_FOUND } from "./pattern";
import { SHRINK_NOT_APPLIED } from "./notes";
import { createReleaseBuilder, type ReleaseDeps } from "./release";

const pattern = gradedJersey(["48"]);

const deps = (over: Partial<ReleaseDeps> = {}): ReleaseDeps => ({
  project: async () => ({ spec: jersey() as GarmentSpec }),
  pattern: async () => ({ ok: true, pattern, reviewed: false, note: "Pattern: Team jersey, version 3. Draft pattern, not reviewed." }),
  context: async (): Promise<PrintContext> => ({ profile: DEFAULT_PRINT_PROFILE, icc: null, rules: { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null }, assets: { getAsset: async () => null } }),
  ...over,
});

const files = [specOf("front", "48", "svg"), specOf("back", "48", "svg"), specOf("collar", "48", "pdf")];
const inputs = (roster: typeof ROSTER_22.rows | null, list = files) => ({ specVersion: 2, patternBlockId: "b", patternBlockVersion: 3, fabricTestIds: [], printProfile: PROFILE, roster, files: list });

describe("createReleaseBuilder", () => {
  it("loads nothing until a file is asked for, and loads once for many files", async () => {
    const project = vi.fn(deps().project);
    const builder = createReleaseBuilder(deps({ project }), null);
    expect(project).not.toHaveBeenCalled();
    await Promise.all([builder.build(files[0]!), builder.build(files[1]!)]);
    expect(project).toHaveBeenCalledTimes(1);
  }, 60_000);

  it("freezes real print files: a SHA-256 for each, the same on a second run, and the file's own bytes hash to it", async () => {
    const first = await buildSnapshot(inputs(null), createReleaseBuilder(deps(), null));
    const second = await buildSnapshot(inputs(null), createReleaseBuilder(deps(), null));
    expect(first.files).toHaveLength(3);
    expect(first.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(second.files).toEqual(first.files);
    const made = await createReleaseBuilder(deps(), null).build(files[0]!);
    expect(new Set(first.files.map((f) => f.sha256)).has(made.sha256)).toBe(true);
    expect(made.warnings.length).toBeGreaterThan(0);
  }, 120_000);

  it("makes a player's file from the team list, and the hash changes when the list does", async () => {
    const row = { ...ROSTER_22.rows[0]!, sizeLabel: "48" };
    const player = specOf("back", "48", "svg", { playerNumber: row.number });
    const withName = await createReleaseBuilder(deps(), [row]).build(player);
    const renamed = await createReleaseBuilder(deps(), [{ ...row, name: "SOMEONE" }]).build(player);
    expect(withName.sha256).not.toBe(renamed.sha256);
    const plain = await createReleaseBuilder(deps(), [row]).build(specOf("back", "48", "svg"));
    expect(plain.sha256).not.toBe(withName.sha256);
  }, 120_000);

  it("says in the margin what it rests on: the pattern, the defaults and that shrink was not applied", async () => {
    const built = await createReleaseBuilder(deps(), null).build(specOf("front", "48", "svg"));
    const text = new TextDecoder().decode(built.bytes);
    expect(text).toContain("Draft pattern, not reviewed.");
    expect(text).toContain("Knitwright defaults");
    expect(SHRINK_NOT_APPLIED).toMatch(/shrink/);
  }, 60_000);

  it("stops with the library's sentence when the pattern cannot be loaded, and for a garment with no pattern at all", async () => {
    const missing = createReleaseBuilder(deps({ pattern: async () => ({ ok: false, reason: PATTERN_NOT_FOUND }) }), null);
    await expect(missing.build(files[0]!)).rejects.toMatchObject({ code: "invalid_input", message: PATTERN_NOT_FOUND });
    await expect(missing.build(files[0]!)).rejects.toBeInstanceOf(AppError);
  });

  it("embeds the brand's colour profile in a TIFF, as the download does", async () => {
    const p3 = (await sharp({ create: { width: 2, height: 2, channels: 3, background: "#808080" } }).png().withIccProfile("p3").toBuffer().then((b) => sharp(b).metadata())).icc;
    if (!p3) throw new Error("no profile");
    const context = async () => ({ ...(await deps().context()), icc: new Uint8Array(p3) });
    const built = await createReleaseBuilder(deps({ context }), null).build(specOf("collar", "48", "tiff"));
    expect(Buffer.from((await sharp(built.bytes).metadata()).icc ?? []).equals(Buffer.from(p3))).toBe(true);
  }, 60_000);
});
