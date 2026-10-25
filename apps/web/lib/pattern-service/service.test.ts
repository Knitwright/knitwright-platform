import { describe, expect, it, vi } from "vitest";
import { attachFiles, createRequest, getRequest, listEvents, listForProject, listQueue, markReviewed, moveRequest, type NewRequest } from "./service";

const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
const row = (status: string, over: Record<string, unknown> = {}) => ({
  id, brand_id: id, project_id: id, design_version: 1, article_id: "shorts", status, snapshot_hash: "h", quoted_price_credits: null,
  quoted_turnaround_days: null, decline_reason: null, file_ids: [], reviewed_by: null, reviewed_on: null, created_at: "t", updated_at: "t", ...over,
});

/** A query that answers with `result` however it is chained. */
const chain = (result: unknown) => {
  const q: Record<string, unknown> = { then: (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok) };
  for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(result);
  return q;
};
const client = (result: unknown) => ({ from: () => chain(result) }) as never;

describe("reads", () => {
  it("lists a design's requests", async () => {
    expect(await listForProject(client({ data: [row("requested")], error: null }), "b", "p")).toHaveLength(1);
    expect(await listForProject(client({ data: null, error: null }), "b", "p")).toEqual([]);
  });

  it("puts open requests first, oldest first, then the finished ones, newest first", async () => {
    const data = [row("delivered", { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a01" }), row("declined", { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a02", decline_reason: "x" }), row("requested", { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a03" }), row("in_progress", { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a04" })];
    const queue = await listQueue(client({ data, error: null }));
    expect(queue.map((r) => r.id.slice(-2))).toEqual(["03", "04", "02", "01"]);
    expect(await listQueue(client({ data: null, error: null }))).toEqual([]);
  });

  it("reads one request, or none", async () => {
    expect((await getRequest(client({ data: row("accepted"), error: null }), id))?.status).toBe("accepted");
    expect(await getRequest(client({ data: null, error: null }), id)).toBeNull();
  });

  it("reads the history", async () => {
    const event = { id, request_id: id, kind: "requested", from_status: null, to_status: "requested", note: "", at: "t" };
    expect(await listEvents(client({ data: [event], error: null }), id)).toHaveLength(1);
    expect(await listEvents(client({ data: null, error: null }), id)).toEqual([]);
  });

  it("says why a read failed", async () => {
    await expect(listQueue(client({ data: null, error: { message: "raw", code: "XX000" } }))).rejects.toMatchObject({ code: "internal" });
  });
});

const input: NewRequest = {
  brandId: "b", userId: "u", projectId: "p", designVersion: 2, articleId: "shorts", snapshot: { projectId: "p", version: 2, garmentType: "shorts", name: "n", spec: {}, sent: [] },
  snapshotHash: "h", quote: { priceCredits: 4, turnaroundWorkingDays: 5 }, charge: true,
};

describe("createRequest", () => {
  it("sends the design, the quote and whether to charge, and reads the answer", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, created: true, request_id: "r1", charged: true, balance: 6 }, error: null });
    expect(await createRequest({ rpc } as never, input)).toEqual({ requestId: "r1", created: true, charged: true, balance: 6 });
    expect(rpc).toHaveBeenCalledWith("pattern_request_create", expect.objectContaining({ p_price_credits: 4, p_turnaround_days: 5, p_charge: true, p_design_version: 2, p_snapshot_hash: "h" }));
  });

  it("reads an answer given as a list, and an existing request", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ok: true, created: false, request_id: "r1", charged: false, balance: 10 }], error: null });
    expect(await createRequest({ rpc } as never, input)).toMatchObject({ created: false, charged: false });
  });

  it("explains that the balance is too low", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: false, reason: "insufficient", price: 4, balance: 1 }, error: null });
    await expect(createRequest({ rpc } as never, input)).rejects.toMatchObject({ code: "conflict", message: "A pattern request costs 4 credits. Your balance is 1." });
    const one = vi.fn().mockResolvedValue({ data: { ok: false, price: 1, balance: 0 }, error: null });
    await expect(createRequest({ rpc: one } as never, input)).rejects.toThrow(/1 credit\./);
    const none = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(createRequest({ rpc: none } as never, input)).rejects.toThrow(/0 credits/);
  });

  it("says why the database refused", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", code: "P0002" } });
    await expect(createRequest({ rpc } as never, input)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("ops writes", () => {
  it("moves a request with the actor and the note", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await moveRequest({ rpc } as never, "a", "r", "declined", "Not draftable");
    expect(rpc).toHaveBeenCalledWith("pattern_request_move", { p_actor: "a", p_request_id: "r", p_to: "declined", p_note: "Not draftable" });
  });
  it("attaches files and records a review", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await attachFiles({ rpc } as never, "a", "r", ["f1"]);
    await markReviewed({ rpc } as never, "a", "r", "Sana");
    expect(rpc).toHaveBeenNthCalledWith(1, "pattern_request_attach_files", { p_actor: "a", p_request_id: "r", p_file_ids: ["f1"] });
    expect(rpc).toHaveBeenNthCalledWith(2, "pattern_request_mark_reviewed", { p_actor: "a", p_request_id: "r", p_reviewer_name: "Sana" });
  });
  it("passes on a refusal", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "raw", hint: "reason_needed" } });
    await expect(moveRequest({ rpc } as never, "a", "r", "declined", "")).rejects.toMatchObject({ code: "conflict" });
  });
});
