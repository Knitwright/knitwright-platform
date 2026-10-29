import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { AppError } from "@/lib/server/core/errors";
import { checkImage, IMAGE_LIMITS } from "@/lib/storage/image";
import { keepPhoto, photoKey, photoStorage, PHOTO_BUCKET, PHOTO_MAX_BYTES, type PhotoDeps } from "./photo";
import { newPacketToken } from "./token";

const PACKET = "11111111-1111-4111-8111-111111111111";
const ID = "44444444-4444-4444-8444-444444444444";
const token = newPacketToken();

const checked = (extension: "jpg" | "png" = "jpg") => ({
  bytes: Buffer.from([1, 2, 3]),
  contentType: extension === "jpg" ? ("image/jpeg" as const) : ("image/png" as const),
  extension,
  width: 10,
  height: 10,
});

const deps = (over: Partial<PhotoDeps> = {}) => {
  const base = {
    check: vi.fn().mockResolvedValue(checked()),
    upload: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    record: vi.fn().mockResolvedValue({ eventId: "e", at: "2026-11-10T12:00:00Z", ordersMoved: 0 }),
    newId: () => ID,
  };
  return { ...base, ...over } as unknown as PhotoDeps & typeof base;
};

/** The real image check, so these tests prove what actually reaches the bucket. */
const realDeps = (over: Partial<PhotoDeps> = {}) => deps({ check: checkImage, ...over });

const input = { token, packetId: PACKET, bytes: new Uint8Array([1, 2, 3]), note: "Line 3" };

describe("photoKey", () => {
  it("puts a packet's photo in a folder of its own, which no brand folder can ever match", () => {
    expect(photoKey(PACKET, ID, "jpg")).toBe(`job-packets/${PACKET}/${ID}.jpg`);
    expect(photoKey(PACKET, ID, "png")).toBe(`job-packets/${PACKET}/${ID}.png`);
    // The first folder is not a brand id, so "members read their brand's files" never matches it.
    expect(photoKey(PACKET, ID, "jpg").split("/")[0]).toBe("job-packets");
  });

  it("is the shape the database insists on before it records the key", () => {
    expect(photoKey(PACKET, ID, "jpg")).toMatch(new RegExp(`^job-packets/${PACKET}/[0-9a-f-]{36}\\.(jpg|png)$`));
  });
});

describe("the limits a photo is held to", () => {
  it("are the ones every uploaded image is held to, in the private bucket", () => {
    expect(PHOTO_MAX_BYTES).toBe(IMAGE_LIMITS.maxBytes);
    expect(PHOTO_MAX_BYTES).toBe(8 * 1024 * 1024);
    expect(PHOTO_BUCKET).toBe("uploads");
  });
});

describe("keepPhoto", () => {
  it("reads the bytes as an image, stores what the check gave back, then records it", async () => {
    const d = deps();

    const recorded = await keepPhoto(d, input);

    expect(recorded.at).toBe("2026-11-10T12:00:00Z");
    expect(d.check).toHaveBeenCalledWith(input.bytes);
    // What is stored is the rewritten pixels, never the bytes the factory sent.
    expect(d.upload).toHaveBeenCalledWith(`job-packets/${PACKET}/${ID}.jpg`, checked().bytes, "image/jpeg");
    expect(d.record).toHaveBeenCalledWith({ token, kind: "photo", note: "Line 3", photoKey: `job-packets/${PACKET}/${ID}.jpg` });
  });

  it("stores a see-through photo as PNG, because the check decided so, not the browser", async () => {
    const d = deps({ check: vi.fn().mockResolvedValue(checked("png")) });

    await keepPhoto(d, input);

    expect(d.upload).toHaveBeenCalledWith(`job-packets/${PACKET}/${ID}.png`, checked("png").bytes, "image/png");
  });

  it("stores and records nothing when the bytes are not an image", async () => {
    const d = deps({ check: vi.fn().mockRejectedValue(new AppError("invalid_input", "Upload a PNG, JPEG or WebP image.")) });

    await expect(keepPhoto(d, input)).rejects.toMatchObject({ code: "invalid_input" });
    expect(d.upload).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("leaves no file behind when the database refuses to record it", async () => {
    const d = deps({ record: vi.fn().mockRejectedValue(new AppError("not_found", "That link does not exist.")) });

    await expect(keepPhoto(d, input)).rejects.toMatchObject({ code: "not_found" });
    expect(d.remove).toHaveBeenCalledWith(`job-packets/${PACKET}/${ID}.jpg`);
  });

  it("raises the database's refusal even when the file could not be removed afterwards", async () => {
    const d = deps({
      record: vi.fn().mockRejectedValue(new AppError("conflict", "This link has taken as much as it can. Ask Knitwright for a new one.")),
      remove: vi.fn().mockRejectedValue(new Error("storage is down")),
    });

    await expect(keepPhoto(d, input)).rejects.toMatchObject({ code: "conflict" });
  });

  it("gives each photo its own name, so one can never overwrite another", async () => {
    const keys: string[] = [];
    const d = deps({ newId: undefined, upload: vi.fn().mockImplementation(async (key: string) => void keys.push(key)) });

    await keepPhoto(d, input);
    await keepPhoto(d, input);

    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    for (const key of keys) expect(key).toMatch(new RegExp(`^job-packets/${PACKET}/[0-9a-f-]{36}\\.jpg$`));
  });
});

describe("what is stored of a real photo", () => {
  /** The whole point of rewriting the image: the camera, place and time details never reach the bucket. */
  it("holds no EXIF: no camera, no place and no time the factory's phone wrote in", async () => {
    const original = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } })
      .withExif({ IFD0: { Make: "TestPhone", Model: "X1", Software: "Camera" }, IFD2: { GPSLatitudeRef: "N" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const stored: Uint8Array[] = [];

    await keepPhoto(realDeps({ upload: vi.fn().mockImplementation(async (_k, bytes: Uint8Array) => void stored.push(bytes)) }), {
      ...input,
      bytes: original,
    });

    const kept = stored[0]!;
    const metadata = await sharp(kept).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("jpeg");
    expect(Buffer.from(kept).includes(Buffer.from("TestPhone"))).toBe(false);
  });

  it("refuses a file that is not an image however it is named, because the bytes decide", async () => {
    const d = realDeps();

    await expect(keepPhoto(d, { ...input, bytes: new TextEncoder().encode("<svg onload=alert(1)>") })).rejects.toMatchObject({
      code: "invalid_input",
      message: "Upload a PNG, JPEG or WebP image.",
    });
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("refuses a file over the size limit before it is read as an image at all", async () => {
    const d = realDeps();

    await expect(keepPhoto(d, { ...input, bytes: new Uint8Array(PHOTO_MAX_BYTES + 1) })).rejects.toMatchObject({ code: "too_large" });
    expect(d.upload).not.toHaveBeenCalled();
  });
});

describe("photoStorage", () => {
  const storage = (over: Record<string, unknown> = {}) => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([7, 8])]), error: null }),
      ...over,
    };
    const from = vi.fn().mockReturnValue(bucket);
    return { admin: { storage: { from } }, bucket, from };
  };

  it("writes to the private uploads bucket and never over a file that is already there", async () => {
    const s = storage();

    await photoStorage(s.admin as never).upload("job-packets/p/a.jpg", new Uint8Array([1]), "image/jpeg");

    expect(s.from).toHaveBeenCalledWith(PHOTO_BUCKET);
    expect(s.bucket.upload).toHaveBeenCalledWith("job-packets/p/a.jpg", new Uint8Array([1]), { contentType: "image/jpeg", upsert: false });
  });

  it("says the photo could not be stored, keeping the storage fault only as the cause", async () => {
    const s = storage({ upload: vi.fn().mockResolvedValue({ error: { message: "bucket is full" } }) });

    await expect(photoStorage(s.admin as never).upload("k", new Uint8Array([1]), "image/jpeg")).rejects.toThrow("The photo could not be stored.");
  });

  it("removes a file by its key", async () => {
    const s = storage();

    await photoStorage(s.admin as never).remove("job-packets/p/a.jpg");

    expect(s.bucket.remove).toHaveBeenCalledWith(["job-packets/p/a.jpg"]);
  });

  it("reads a file's bytes for ops, and says so when it cannot", async () => {
    const s = storage();

    expect(await photoStorage(s.admin as never).read("job-packets/p/a.jpg")).toEqual(new Uint8Array([7, 8]));
    const missing = storage({ download: vi.fn().mockResolvedValue({ data: null, error: { message: "not there" } }) });
    await expect(photoStorage(missing.admin as never).read("k")).rejects.toThrow("The photo could not be read.");
    const failed = storage({ download: vi.fn().mockResolvedValue({ data: new Blob([]), error: { message: "x" } }) });
    await expect(photoStorage(failed.admin as never).read("k")).rejects.toThrow("The photo could not be read.");
  });
});
