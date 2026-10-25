import { describe, expect, it } from "vitest";
import { canShareFiles, shareFile } from "./share";

const png = new Blob(["x"], { type: "image/png" });
const fetcher = async () => new Response(png, { status: 200 });

describe("canShareFiles", () => {
  it("is false where the browser cannot share files, or has no share at all", () => {
    expect(canShareFiles(undefined)).toBe(false);
    expect(canShareFiles({})).toBe(false);
    expect(canShareFiles({ share: async () => undefined })).toBe(false);
    expect(canShareFiles({ share: async () => undefined, canShare: () => false })).toBe(false);
  });

  it("is true when the browser says it can share a picture", () => {
    expect(canShareFiles({ share: async () => undefined, canShare: () => true })).toBe(true);
  });
});

describe("shareFile", () => {
  it("shares the picture as a file with its name", async () => {
    const shared: ShareData[] = [];
    const nav = { share: async (data: ShareData) => void shared.push(data), canShare: () => true };
    expect(await shareFile("/pic", "knitwright-front.png", nav, fetcher)).toEqual({ ok: true });
    expect(shared[0]?.files?.[0]?.name).toBe("knitwright-front.png");
    expect(shared[0]?.files?.[0]?.type).toBe("image/png");
  });

  it("treats a person closing the share sheet as nothing to report", async () => {
    const nav = { share: async () => Promise.reject(new DOMException("closed", "AbortError")), canShare: () => true };
    expect(await shareFile("/pic", "a.png", nav, fetcher)).toEqual({ ok: true });
  });

  it("reports a failed read or a failed share", async () => {
    const nav = { share: async () => Promise.reject(new Error("no")), canShare: () => true };
    expect(await shareFile("/pic", "a.png", nav, fetcher)).toEqual({ ok: false });
    expect(await shareFile("/pic", "a.png", { share: async () => undefined, canShare: () => true }, async () => new Response("no", { status: 404 }))).toEqual({ ok: false });
  });

  it("does not share where the browser cannot", async () => {
    expect(await shareFile("/pic", "a.png", undefined, fetcher)).toEqual({ ok: false });
  });
});
