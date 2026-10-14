import { afterEach, describe, expect, it, vi } from "vitest";
import { accept, discard, readPicture, readingFrom, refit, replaceLayer, unwrap, uploadPicture } from "./api";

const ok = (data: unknown) => ({ success: true, data });
const reply = (body: unknown) => vi.fn(async () => ({ json: async () => body }) as Response);

afterEach(() => vi.unstubAllGlobals());

describe("unwrap and readingFrom", () => {
  it("reads the envelope and refuses what it does not recognise", () => {
    expect(unwrap(ok(1))).toEqual({ ok: true, data: 1 });
    expect(unwrap({ success: false, error: { message: "No." } })).toEqual({ ok: false, message: "No." });
    expect(unwrap({ success: false })).toMatchObject({ ok: false });
    expect(unwrap("x")).toMatchObject({ ok: false });
    expect(readingFrom(ok({ kind: "ready", view: { id: "i" } }))).toEqual({ ok: true, data: { id: "i" } });
    expect(readingFrom(ok({ kind: "rejection", reason: "Because." }))).toEqual({ ok: false, message: "Because." });
    expect(readingFrom(ok({ kind: "ready" }))).toMatchObject({ ok: false });
    expect(readingFrom(ok("x"))).toMatchObject({ ok: false });
    expect(readingFrom({ success: false, error: { message: "Over." } })).toEqual({ ok: false, message: "Over." });
  });
});

describe("the calls", () => {
  it("upload, read, refit, accept and discard send the right things", async () => {
    const fetchMock = vi.fn(async (url: string, ...rest: [RequestInit?]) => {
      void rest;
      const body = url === "/api/files" ? ok({ id: "f1" }) : url.endsWith("/accept") ? ok({ layerIds: ["ground"], needsOwnFile: ["mark-2"] }) : url.endsWith("/discard") ? ok({ discarded: true }) : ok({ kind: "ready", view: { id: "i1" } });
      return { json: async () => body } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await uploadPicture(new File(["x"], "a.png", { type: "image/png" }))).toEqual({ ok: true, data: "f1" });
    expect(await readPicture("f1")).toEqual({ ok: true, data: { id: "i1" } });
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({ fileId: "f1", rights: true });
    expect((await refit("i1", { front: { hps: { x: 0.1, y: 0.2 } } })).ok).toBe(true);
    expect(await accept("i1", "all")).toEqual({ ok: true, data: { layerIds: ["ground"], needsOwnFile: ["mark-2"] } });
    expect(await discard("i1")).toEqual({ ok: true, data: true });
  });

  it("replaces a layer with the person's own artwork", async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ok({ kind: "ready", view: { id: "i1" } }) }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await replaceLayer("i1", "mark-2", "cccccccc-0000-4000-8000-000000000001")).toEqual({ ok: true, data: { id: "i1" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/design-import/i1/replace");
    expect(JSON.parse(init.body as string)).toEqual({ layerId: "mark-2", artworkId: "cccccccc-0000-4000-8000-000000000001" });
  });

  it("says so when the server cannot be reached or answers oddly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await readPicture("f")).toMatchObject({ ok: false, message: expect.stringContaining("could not reach") });
    expect(await uploadPicture(new File(["x"], "a.png"))).toMatchObject({ ok: false });
    vi.stubGlobal("fetch", reply(null));
    expect(await uploadPicture(new File(["x"], "a.png"))).toMatchObject({ ok: false });
    vi.stubGlobal("fetch", reply(ok({ nope: 1 })));
    expect(await uploadPicture(new File(["x"], "a.png"))).toMatchObject({ ok: false });
    expect(await accept("i", ["a"])).toMatchObject({ ok: false });
    vi.stubGlobal("fetch", reply({ success: false, error: { message: "Gone." } }));
    expect(await discard("i")).toEqual({ ok: false, message: "Gone." });
  });
});
