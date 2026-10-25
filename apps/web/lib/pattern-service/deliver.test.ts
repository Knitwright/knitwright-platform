import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/store", () => ({ storeProductionFile: store }));

import { attachDelivered, looksLikeDxf } from "./deliver";

const dxf = (text = "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n") => new TextEncoder().encode(text);
const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
const row = (status: string) => ({
  id, brand_id: id, project_id: id, design_version: 1, article_id: "shorts", status, snapshot_hash: "h", quoted_price_credits: null,
  quoted_turnaround_days: null, decline_reason: null, file_ids: [], reviewed_by: null, reviewed_on: null, created_at: "t", updated_at: "t",
});
const client = (data: unknown) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data, error: null }) }) }) }) }) as never;

describe("looksLikeDxf", () => {
  it("accepts a DXF and refuses anything else", () => {
    expect(looksLikeDxf(dxf())).toBe(true);
    expect(looksLikeDxf(dxf("  0\r\nSECTION\r\n"))).toBe(true);
    expect(looksLikeDxf(dxf("%PDF-1.7"))).toBe(false);
    expect(looksLikeDxf(new Uint8Array())).toBe(false);
    expect(looksLikeDxf(new Uint8Array(10 * 1024 * 1024 + 1))).toBe(false);
  });
});

describe("attachDelivered", () => {
  beforeEach(() => store.mockReset());

  it("stores each file under the request's brand and lists them on the request", async () => {
    store.mockResolvedValueOnce({ id: "f1" }).mockResolvedValueOnce({ id: "f2" });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const out = await attachDelivered({ rpc } as never, client(row("in_progress")), "actor", id, [{ name: "a.dxf", bytes: dxf() }, { name: "b.dxf", bytes: dxf() }]);
    expect(out).toEqual({ fileIds: ["f1", "f2"] });
    expect(store).toHaveBeenCalledWith("pattern-source", expect.objectContaining({ brandId: id, userId: "actor", contentType: "application/dxf" }));
    expect(rpc).toHaveBeenCalledWith("pattern_request_attach_files", { p_actor: "actor", p_request_id: id, p_file_ids: ["f1", "f2"] });
  });

  it("answers not found for a request that is not there", async () => {
    await expect(attachDelivered({} as never, client(null), "a", id, [{ name: "a", bytes: dxf() }])).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses a request that is not being drafted", async () => {
    await expect(attachDelivered({} as never, client(row("accepted")), "a", id, [{ name: "a", bytes: dxf() }])).rejects.toMatchObject({ code: "conflict" });
  });

  it("stores nothing when one file is not a DXF", async () => {
    await expect(attachDelivered({} as never, client(row("in_progress")), "a", id, [{ name: "a", bytes: dxf() }, { name: "b", bytes: dxf("not a dxf") }])).rejects.toMatchObject({ code: "invalid_input" });
    expect(store).not.toHaveBeenCalled();
  });
});
