import { describe, expect, it } from "vitest";
import { TOO_LARGE, type FileReader, type StoredBytes } from "@/lib/storage/read";
import { imageForCard, imageType, MAX_PHOTO_BYTES, PHOTO_NOT_FOUND, PHOTO_TOO_LARGE, PHOTO_WRONG_TYPE } from "./photo";

/** A photo intake reads the member's own upload and nothing else. Nothing is fetched from anybody. */

const readerOf = (answer: StoredBytes | typeof TOO_LARGE | null): FileReader & { asked: { fileId: string; maxBytes: number }[] } => {
  const asked: { fileId: string; maxBytes: number }[] = [];
  return {
    asked,
    async read(fileId, maxBytes) {
      asked.push({ fileId, maxBytes });
      return answer;
    },
  };
};

describe("imageType", () => {
  it("takes the picture types a vision model reads, however the type is written", () => {
    expect(imageType("image/png")).toBe("image/png");
    expect(imageType("image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(imageType(" IMAGE/WEBP ")).toBe("image/webp");
  });

  it("takes nothing else, so a PDF or an SVG is refused rather than sent and charged for", () => {
    for (const type of ["application/pdf", "image/svg+xml", "text/html", ""]) expect(imageType(type), type).toBeNull();
  });
});

describe("imageForCard", () => {
  it("reads the file through the brand's own reader and hands back its bytes in base64", async () => {
    const reader = readerOf({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });

    expect(await imageForCard(reader, "file-1")).toEqual({ mediaType: "image/png", base64: "AQID" });
    expect(reader.asked).toEqual([{ fileId: "file-1", maxBytes: MAX_PHOTO_BYTES }]);
  });

  it("says the photo is not there when it belongs to another brand or does not exist", async () => {
    await expect(imageForCard(readerOf(null), "file-1")).rejects.toThrow(PHOTO_NOT_FOUND);
  });

  it("says a photo over the limit is too large, before any of it is downloaded", async () => {
    await expect(imageForCard(readerOf(TOO_LARGE), "file-1")).rejects.toThrow(PHOTO_TOO_LARGE);
  });

  it("refuses a file that is not a picture a model reads", async () => {
    const reader = readerOf({ bytes: new Uint8Array([1]), contentType: "application/pdf" });

    await expect(imageForCard(reader, "file-1")).rejects.toThrow(PHOTO_WRONG_TYPE);
  });
});
