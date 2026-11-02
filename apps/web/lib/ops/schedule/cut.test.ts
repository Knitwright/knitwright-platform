import { describe, expect, it, vi } from "vitest";
import { admitCron, CRON_SECRET_MISSING, describeRun } from "./cut";
import { listCutRuns, runScheduledCut } from "./service";

describe("admitCron", () => {
  it("lets the scheduler in with the deploy's secret", () => {
    expect(admitCron("Bearer s3cret-value", "s3cret-value")).toEqual({ ok: true });
    expect(admitCron("bearer s3cret-value", "s3cret-value")).toEqual({ ok: true });
  });

  it("switches the job off where no secret is set, rather than running it for anyone", () => {
    expect(admitCron("Bearer anything", undefined)).toEqual({ ok: false, status: 503, reason: CRON_SECRET_MISSING });
    expect(admitCron("Bearer anything", "   ")).toMatchObject({ status: 503 });
  });

  it("answers not found for a wrong secret, a missing header and one of another length", () => {
    expect(admitCron("Bearer wrong", "s3cret-value")).toMatchObject({ ok: false, status: 404, reason: "Not found." });
    expect(admitCron(null, "s3cret-value")).toMatchObject({ status: 404 });
    expect(admitCron("Bearer s3cret-value-and-more", "s3cret-value")).toMatchObject({ status: 404 });
  });
});

describe("describeRun", () => {
  it("says what was cut, how many, and when nothing was waiting", () => {
    expect(describeRun({ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 4, ran: true })).toBe("Cut 4 orders for the cut-off of 2026-12-07.");
    expect(describeRun({ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 1, ran: true })).toContain("Cut 1 order ");
    expect(describeRun({ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 0, ran: true })).toBe("No order was waiting at the cut-off of 2026-12-07.");
  });

  it("says plainly that a second run cut nothing again", () => {
    expect(describeRun({ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 4, ran: false })).toBe("The cut-off of 2026-12-07 was already cut, so nothing was cut again.");
  });
});

describe("runScheduledCut", () => {
  it("reads the run the database made", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ cut_for: "2026-12-07T12:00:00Z", orders_batched: 2, ran: true }], error: null });
    expect(await runScheduledCut({ rpc } as never)).toEqual({ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 2, ran: true });
    expect(rpc).toHaveBeenCalledWith("ops_cut_scheduled", {});
  });

  it("passes a clock when it is given one, so a test can cut as of a moment", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { cut_for: "2026-12-07T12:00:00Z", orders_batched: 0, ran: false }, error: null });
    await runScheduledCut({ rpc } as never, new Date("2026-12-08T00:00:00Z"));
    expect(rpc).toHaveBeenCalledWith("ops_cut_scheduled", { p_now: "2026-12-08T00:00:00.000Z" });
  });

  it("refuses when the database does, and when it answers with nothing", async () => {
    const bad = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", code: "P0002" } });
    await expect(runScheduledCut({ rpc: bad } as never)).rejects.toThrow(/does not exist/);
    const empty = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(runScheduledCut({ rpc: empty } as never)).rejects.toThrow(/answered with nothing/);
  });
});

describe("listCutRuns", () => {
  it("reads the runs so far, newest first", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ cut_for: "2026-12-07T12:00:00Z", orders_batched: 3 }], error: null });
    const from = vi.fn(() => ({ select: () => ({ order: () => ({ limit }) }) }));
    expect(await listCutRuns({ from } as never)).toEqual([{ cutFor: "2026-12-07T12:00:00.000Z", ordersBatched: 3, ran: true }]);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("refuses when the read fails", async () => {
    const from = vi.fn(() => ({ select: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "raw", code: "42501" } }) }) }) }));
    await expect(listCutRuns({ from } as never)).rejects.toThrow();
  });
});
