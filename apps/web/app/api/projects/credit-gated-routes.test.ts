import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The four routes that make something that costs credits, called with the flag off and on. The
 * framework's `defineRoute` is replaced by one that returns its config, so the handler is called
 * directly with the context the framework would build; the work each route does is replaced by a
 * stand-in, because the point here is only what the credit gate does around it.
 */
const state = vi.hoisted(() => ({
  enforced: false,
  balance: 5,
  spends: [] as { kind: string; hash: string; usageEventId?: string }[],
  versionReads: 0,
  logs: [] as string[],
  patterns: true,
}));

vi.mock("@/lib/server/define-route", () => ({ defineRoute: (config: unknown) => config }));
vi.mock("@/lib/server/deps", () => ({
  sessionClient: async () => ({}),
  adminClient: () => ({}),
  imageProvider: () => ({}),
  productionDeps: { usage: { refund: async () => true } },
}));
vi.mock("@/lib/credits-gate/server", async () => {
  const { createGate } = await import("@/lib/credits-gate/gate");
  const { createWithCredits } = await import("@/lib/credits-gate/with-credits");
  const gate = createGate({
    enforced: () => state.enforced,
    service: () => ({
      ensureMonthlyAllowance: async () => ({ applied: false, balance: state.balance }),
      spendCredits: async (input) => {
        if (state.balance < 1) return { ok: false, reason: "insufficient", price: 1, balance: state.balance };
        const seen = state.spends.some((s) => s.kind === input.kind && s.hash === input.designVersionHash);
        if (!seen) state.balance -= 1;
        state.spends.push({ kind: input.kind, hash: input.designVersionHash, ...(input.usageEventId ? { usageEventId: input.usageEventId } : {}) });
        return { ok: true, charged: !seen, price: 1, balance: state.balance, entryId: null };
      },
    }),
    log: (event) => state.logs.push(event.message),
    now: () => new Date(0),
  });
  return {
    withCredits: createWithCredits(gate),
    versionOf: async (_brand: string, projectId: string) => {
      state.versionReads += 1;
      return { projectId, version: 2 };
    },
  };
});

vi.mock("@/lib/projects/export-download", () => ({
  serveExport: async () => new Response("file", { status: 200 }),
}));
vi.mock("@/lib/projects/export-record", () => ({ recordDownload: async () => {} }));
vi.mock("@/lib/projects/tech-pack-load", () => ({ loadTechPackSource: async () => ({}) }));
vi.mock("@/lib/print/inputs/deps", () => ({ loadPrintDeps: async () => ({}) }));
vi.mock("@/lib/print/service", async (original) => ({
  ...(await original<typeof import("@/lib/print/service")>()),
  servePrintFiles: async () => new Response("zip", { status: 200 }),
}));
vi.mock("@/lib/config/env", () => ({ getEnv: () => ({ PATTERN_PROVIDER: state.patterns ? "claude-bridge" : undefined }) }));
vi.mock("@/lib/patterns/access", () => ({ patternsOpenTo: () => true }));
vi.mock("@/lib/projects/service", () => ({ getProject: async () => ({ currentVersion: 2, spec: {} }) }));
vi.mock("@/lib/patterns/request", () => ({ patternRequest: () => ({}) }));
vi.mock("@/lib/patterns/service", () => ({
  createPatternJob: async () => "job-1",
  latestPatternJob: async () => ({ id: "job-1" }),
  expirePatternJob: async () => {},
}));
vi.mock("@/lib/patterns/job-view", () => ({ patternJobView: () => ({ status: "queued" }) }));
vi.mock("@/lib/images/start", () => ({ startImageJob: async () => ({ jobId: "img-1" }) }));
vi.mock("@/lib/images/service", () => ({ createJob: vi.fn(), imageRemover: vi.fn(), imageSaver: vi.fn(), jobStore: vi.fn() }));
vi.mock("@/lib/charts/service", () => ({ brandChartSet: async () => ({}) }));
vi.mock("@/lib/projects/artwork-images", () => ({ loadArtworkImages: async () => ({ images: [] }) }));
vi.mock("@/lib/storage/read", () => ({ createFileReader: () => ({}) }));
vi.mock("@/lib/storage/store", () => ({ ensureStorageRoom: async () => {} }));
vi.mock("@/lib/storage/thumbnail", () => ({ shrinkForDrawing: () => {} }));
vi.mock("next/server", () => ({ after: () => {} }));

const PROJECT = "11111111-1111-4111-8111-111111111111";
const session = { userId: "u1", email: "o@example.com", brand: { id: "b1", name: "B", role: "owner" } };
const base = { session, request: new Request("http://x"), usage: { eventId: "ev-1", refund: async () => {}, reserve: async () => null } };

type Handler = (context: unknown) => Promise<unknown>;
const call = async (route: unknown, input: unknown): Promise<unknown> =>
  ((route as { handler: Handler }).handler)({ ...base, input });

const exportsRoute = async () => (await import("./[projectId]/exports/[format]/route")).GET;
const printRoute = async () => (await import("./[projectId]/print-files/route")).GET;
const patternsRoute = async () => (await import("./[projectId]/patterns/route")).POST;
const imagesRoute = async () => (await import("./[projectId]/images/route")).POST;

beforeEach(() => {
  state.enforced = false;
  state.balance = 5;
  state.spends = [];
  state.versionReads = 0;
  state.logs = [];
  state.patterns = true;
});

const cases = [
  { name: "full tech pack PDF", kind: "techpack_pdf", route: exportsRoute, input: { params: { projectId: PROJECT, format: "pdf" }, query: {} } },
  { name: "print files", kind: "pattern_file", route: printRoute, input: { params: { projectId: PROJECT }, query: { formats: ["pdf"] } } },
  { name: "pattern request", kind: "pattern_file", route: patternsRoute, input: { params: { projectId: PROJECT }, body: { size: "M", kind: "single" } } },
  { name: "photoreal images", kind: "marketing_media", route: imagesRoute, input: { params: { projectId: PROJECT }, body: {} } },
] as const;

describe.each(cases)("$name", ({ kind, route, input }) => {
  it("with the flag off charges nothing, reads no version and logs what it would have cost", async () => {
    await call(await route(), input);
    expect(state.spends).toEqual([]);
    expect(state.versionReads).toBe(0);
    expect(state.balance).toBe(5);
    expect(state.logs[0]).toMatch(/would have cost 1 credit/);
  });

  it("with the flag on charges once for the version and not again on a repeat", async () => {
    state.enforced = true;
    const handler = await route();
    await call(handler, input);
    await call(handler, input);
    expect(state.spends.map((s) => s.kind)).toEqual([kind, kind]);
    expect(state.spends[0]?.hash).toBe(state.spends[1]?.hash);
    expect(state.balance).toBe(4);
  });

  it("with the flag on and no credits refuses with the price and balance, and makes nothing", async () => {
    state.enforced = true;
    state.balance = 0;
    await expect(call(await route(), input)).rejects.toMatchObject({ code: "conflict", message: expect.stringMatching(/costs 1 credit.*balance is 0/) });
  });
});

describe("what stays free or unchanged", () => {
  it("the Excel file and the SVG drawings never charge, even with the flag on", async () => {
    state.enforced = true;
    const handler = await exportsRoute();
    await call(handler, { params: { projectId: PROJECT, format: "xlsx" }, query: {} });
    await call(handler, { params: { projectId: PROJECT, format: "svg" }, query: { view: "front" } });
    expect(state.spends).toEqual([]);
    expect(state.logs).toEqual([]);
  });

  it("a pattern request is not charged while patterns are not available", async () => {
    state.enforced = true;
    state.patterns = false;
    await expect(call(await patternsRoute(), cases[2].input)).rejects.toMatchObject({ code: "unavailable" });
    expect(state.spends).toEqual([]);
  });

  it("the photoreal charge names the metered call it pays for", async () => {
    state.enforced = true;
    await call(await imagesRoute(), cases[3].input);
    expect(state.spends[0]?.usageEventId).toBe("ev-1");
  });

  it("a file answer is unchanged with the flag off and carries the balance with it on", async () => {
    const handler = await exportsRoute();
    const off = (await call(handler, cases[0].input)) as Response;
    expect(off.headers.get("x-credits-balance")).toBeNull();
    state.enforced = true;
    const on = (await call(handler, cases[0].input)) as Response;
    expect(on.headers.get("x-credits-balance")).toBe("4");
    expect(await on.text()).toBe("file");
  });
});
