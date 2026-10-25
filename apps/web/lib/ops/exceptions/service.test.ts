import { describe, expect, it, vi } from "vitest";
import { raiseException, resolveException, updateException, listExceptions } from "./service";

const row = { id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a12", kind: "remake", status: "open", owner: "Sam", due_on: "2026-11-05", detail: { M: 1 }, note: "", resolution: null, resolved_on: null, created_at: "2026-10-26T10:00:00Z" };

describe("exceptions service", () => {
  it("raises, updates and resolves through the ops functions with the actor", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "new-id", error: null });
    expect(await raiseException({ rpc } as never, "actor", { orderId: "o", kind: "lost_parcel", owner: "Sam", dueOn: "2026-11-05", note: "", detail: {} })).toBe("new-id");
    await updateException({ rpc } as never, "actor", "e", "Jo", "2026-11-09", "moved");
    await resolveException({ rpc } as never, "actor", "e", "Reshipped");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["ops_raise_exception", "ops_update_exception", "ops_resolve_exception"]);
    expect(rpc.mock.calls.every((c) => c[1].p_actor === "actor")).toBe(true);
  });

  it("turns a refusal into a message", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "already_resolved" } });
    await expect(resolveException({ rpc } as never, "actor", "e", "x")).rejects.toMatchObject({ code: "conflict" });
  });

  it("lists as exceptions, for one order or all", async () => {
    const chain = { eq: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [row], error: null }) };
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    const client = { from: () => ({ select: () => chain }) };
    expect((await listExceptions(client as never, { orderId: "o" }))[0]).toMatchObject({ kind: "remake", dueOn: "2026-11-05", owner: "Sam" });
    expect(chain.eq).toHaveBeenCalledWith("order_id", "o");
    await listExceptions(client as never);
    expect(chain.eq).toHaveBeenCalledTimes(1);
  });
});
