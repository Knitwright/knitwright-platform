import { describe, expect, it, vi } from "vitest";
import { UNREACHABLE, askForPattern, fileLink, readLatestPattern } from "./client";

const ID = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const view = {
  id: ID,
  version: 2,
  size: "M",
  status: "waiting",
  draft: null,
  pieces: null,
  notes: [],
  dxfFileId: null,
  previewFileId: null,
  message: null,
};

describe("askForPattern", () => {
  it("sends the size and returns the new job", async () => {
    const fetcher = vi.fn(async () => json({ success: true, data: view }));

    const result = await askForPattern("p1", "L", fetcher);

    expect(result).toEqual({ ok: true, job: view });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/projects/p1/patterns");
    expect(JSON.parse(String(init.body))).toEqual({ size: "L" });
  });

  it("passes on the server's reason, and a plain one when the answer is odd", async () => {
    expect(await askForPattern("p1", "M", async () => json({ success: false, error: { message: "Patterns are not available yet." } }, 503))).toEqual({
      ok: false,
      reason: "Patterns are not available yet.",
    });
    expect((await askForPattern("p1", "M", async () => json({ nope: true }))).ok).toBe(false);
  });

  it("says the server could not be reached", async () => {
    const result = await askForPattern("p1", "M", async () => {
      throw new TypeError("offline");
    });
    expect(result).toEqual({ ok: false, reason: UNREACHABLE });
  });
});

describe("readLatestPattern", () => {
  it("returns whether patterns are available and the newest job", async () => {
    expect(await readLatestPattern("p1", async () => json({ success: true, data: { available: true, job: view } }))).toEqual({
      available: true,
      job: view,
    });
  });

  it("is null when the answer cannot be read or the server cannot be reached", async () => {
    expect(await readLatestPattern("p1", async () => json({ success: false, error: { message: "x" } }))).toBeNull();
    expect(
      await readLatestPattern("p1", async () => {
        throw new TypeError("offline");
      }),
    ).toBeNull();
  });
});

describe("fileLink", () => {
  it("returns the link, or null", async () => {
    expect(await fileLink(FILE, async () => json({ success: true, data: { url: "https://x/y", expiresInSeconds: 60 } }))).toBe("https://x/y");
    expect(await fileLink(FILE, async () => json({ success: false, error: { message: "no" } }, 404))).toBeNull();
    expect(
      await fileLink(FILE, async () => {
        throw new TypeError("offline");
      }),
    ).toBeNull();
  });
});
