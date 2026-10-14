import { describe, expect, it, vi } from "vitest";
import { UNREACHABLE, dxfAddress, readBlock, readLibrary, sendReview, uploadSet } from "./client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ID = "11111111-1111-4111-8111-111111111111";

describe("readLibrary", () => {
  it("returns whether the library is open and its slots", async () => {
    const result = await readLibrary(async () => json({ success: true, data: { open: true, slots: [] } }));
    expect(result).toEqual({ ok: true, data: { open: true, slots: [] } });
  });

  it("passes on the server's reason, or a plain one for an odd answer, or says it cannot reach the server", async () => {
    expect(await readLibrary(async () => json({ success: false, error: { message: "Sign in to continue." } }, 401))).toEqual({ ok: false, reason: "Sign in to continue." });
    expect((await readLibrary(async () => json({ success: true, data: { nope: 1 } }))).ok).toBe(false);
    expect((await readLibrary(async () => new Response("not json"))).ok).toBe(false);
    expect(await readLibrary(async () => { throw new TypeError("offline"); })).toEqual({ ok: false, reason: UNREACHABLE });
  });
});

describe("readBlock, uploadSet and sendReview", () => {
  it("read a block's detail", async () => {
    const fetcher = vi.fn(async () => json({ success: true, data: { block: { id: ID }, sizes: [], reviews: [] } }));
    expect((await readBlock(ID, fetcher)).ok).toBe(true);
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(`/api/pattern-library/${ID}`);
    expect((await readBlock(ID, async () => json({ success: true, data: 1 }))).ok).toBe(false);
  });

  it("post the files as a form and the review as JSON", async () => {
    const form = new FormData();
    form.set("productKey", "crew-tee");
    const fetcher = vi.fn(async () => json({ success: true, data: { id: ID, version: 1, sizes: ["M"], questions: [], warnings: [], derived: [] } }));
    expect((await uploadSet(form, fetcher)).ok).toBe(true);
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(form);
    const review = vi.fn(async () => json({ success: true, data: { id: ID } }));
    const sent = { reviewerName: "A. Tailor", reviewerRole: "technician", note: "", reviewedOn: "2026-10-20" };
    expect((await sendReview(ID, sent, review)).ok).toBe(true);
    expect(JSON.parse(String((review.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual(sent);
    expect((await uploadSet(form, async () => json({ success: true, data: { id: ID } }))).ok).toBe(false);
  });
});

describe("dxfAddress", () => {
  it("names the block and the size", () => {
    expect(dxfAddress(ID, "2XL")).toBe(`/api/pattern-library/${ID}/dxf?size=2XL`);
    expect(dxfAddress(ID, "all")).toContain("size=all");
  });
});
