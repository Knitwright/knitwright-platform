import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { madeUpMark, otherPicture, plainPicture } from "./fixtures/pictures";
import { hashReasons, screenImageContent } from "./image";
import { detailBits, hammingDistance, hasEnoughDetail, imageHash, MIN_DETAIL_BITS } from "./image-hash";
import { DEFAULT_SETTINGS } from "./settings";
import type { Mark } from "./types";
import { createStubVisionCheck } from "./vision";

const markOf = (hash: string): Mark => ({ id: "m", holder: "Made Up Ltd", markText: null, imageHash: hash });
const FLAT = "0".repeat(32);
const BUSY = "f".repeat(32);

describe("the image hash", () => {
  it("is 32 hex digits and the same for the same picture", async () => {
    const a = await imageHash(await madeUpMark());
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await imageHash(await madeUpMark())).toBe(a);
  });

  it("stays within the blocking distance when the picture is resized, recompressed or slightly recoloured", async () => {
    const base = await imageHash(await madeUpMark(200));
    const others = await Promise.all([
      imageHash(await madeUpMark(60)),
      imageHash(await madeUpMark(600)),
      imageHash(await sharp(await madeUpMark(300)).jpeg({ quality: 40 }).toBuffer()),
      imageHash(await sharp(await madeUpMark(300)).jpeg({ quality: 80 }).toBuffer()),
      imageHash(await madeUpMark(200, "#22337a")),
    ]);
    for (const other of others) expect(hammingDistance(base, other)).toBeLessThanOrEqual(DEFAULT_SETTINGS.imageBlockDistance);
  });

  it("is far past the flagging distance from a different picture", async () => {
    const distance = hammingDistance(await imageHash(await madeUpMark()), await imageHash(await otherPicture()));
    expect(distance).toBeGreaterThan(DEFAULT_SETTINGS.imageFlagDistance * 2);
  });

  it("tells a picture whose structure runs downwards from a plain one, which a sideways-only hash cannot", async () => {
    const stripes = await imageHash(await otherPicture());
    expect(detailBits(stripes)).toBeGreaterThanOrEqual(MIN_DETAIL_BITS);
    expect(hammingDistance(stripes, await imageHash(await plainPicture()))).toBeGreaterThan(DEFAULT_SETTINGS.imageFlagDistance);
  });

  it("finds almost no edge in a plain picture, so it is not worth comparing", async () => {
    expect(hasEnoughDetail(await imageHash(await plainPicture()))).toBe(false);
    expect(hasEnoughDetail(await imageHash(await madeUpMark()))).toBe(true);
  });

  it("counts differing bits, and refuses a malformed hash", () => {
    expect(hammingDistance(FLAT, `${"0".repeat(31)}f`)).toBe(4);
    expect(hammingDistance(BUSY, FLAT)).toBe(128);
    expect(detailBits(BUSY)).toBe(128);
    expect(() => hammingDistance("xyz", FLAT)).toThrow(/32 hex/);
    expect(() => detailBits("0".repeat(16))).toThrow(/32 hex/);
  });
});

describe("hash reasons", () => {
  const settings = DEFAULT_SETTINGS;
  const busyWith = (differing: number): string => `${"f".repeat(32 - differing / 4)}${"0".repeat(differing / 4)}`;

  it("blocks a near-identical picture, flags a similar one and ignores a distant one", () => {
    expect(hashReasons(BUSY, [markOf(busyWith(4))], settings)[0]).toMatchObject({ code: "mark_image_match", severity: "block" });
    expect(hashReasons(BUSY, [markOf(busyWith(16))], settings)[0]).toMatchObject({ code: "mark_image_near", severity: "flag" });
    expect(hashReasons(BUSY, [markOf(busyWith(40))], settings)).toEqual([]);
  });

  it("ignores a mark that has no picture", () => {
    expect(hashReasons(BUSY, [{ id: "t", holder: "x", markText: "Nike", imageHash: null }], settings)).toEqual([]);
  });

  it("never compares a plain picture, in either direction: every flat picture would match every other", () => {
    expect(hashReasons(FLAT, [markOf(BUSY)], settings)).toEqual([expect.objectContaining({ code: "hash_too_plain", severity: "note" })]);
    expect(hashReasons(BUSY, [markOf(FLAT)], settings)).toEqual([]);
  });
});

describe("screening a picture", () => {
  it("blocks an upload of a registered mark picture", async () => {
    const registered = await imageHash(await madeUpMark());
    const out = await screenImageContent({ bytes: await madeUpMark(150), marks: [markOf(registered)], settings: DEFAULT_SETTINGS, vision: createStubVisionCheck() });
    expect(out.reasons.map((r) => r.code)).toEqual(["mark_image_match"]);
  });

  it("clears an unrelated picture", async () => {
    const registered = await imageHash(await madeUpMark());
    const out = await screenImageContent({ bytes: await otherPicture(), marks: [markOf(registered)], settings: DEFAULT_SETTINGS, vision: createStubVisionCheck() });
    expect(out.reasons).toEqual([]);
    expect(out.hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("notes, without holding anything back, that no vision model is configured", async () => {
    const out = await screenImageContent({ bytes: await otherPicture(), marks: [], settings: DEFAULT_SETTINGS, vision: null });
    expect(out.reasons).toEqual([expect.objectContaining({ code: "vision_not_configured", severity: "note" })]);
  });

  it("flags what the vision check says it saw, for a person to decide", async () => {
    const vision = createStubVisionCheck([{ marks: ["Some Brand"], offensive: true }]);
    const out = await screenImageContent({ bytes: await otherPicture(), marks: [], settings: DEFAULT_SETTINGS, vision });
    expect(out.reasons.map((r) => [r.code, r.severity])).toEqual([["vision_mark", "flag"], ["vision_offensive", "flag"]]);
    expect(vision.calls).toBe(1);
  });

  it("flags a picture when the vision check fails: a failed check is not a pass", async () => {
    const out = await screenImageContent({ bytes: await otherPicture(), marks: [], settings: DEFAULT_SETTINGS, vision: createStubVisionCheck([new Error("down")]) });
    expect(out.reasons).toEqual([expect.objectContaining({ code: "vision_unavailable", severity: "flag" })]);
  });

  it("refuses bytes that are not a picture, and never calls the vision check", async () => {
    const vision = createStubVisionCheck();
    await expect(screenImageContent({ bytes: new Uint8Array([1, 2, 3]), marks: [], settings: DEFAULT_SETTINGS, vision })).rejects.toThrow();
    expect(vision.calls).toBe(0);
  });
});
