import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLAGS_NOT_READ, placeOrder } from "./place-order";
import type { RunContext } from "./run-context";
import type { RunBody } from "./schemas";

const state = vi.hoisted(() => ({ stage: "run" as string, context: null as unknown, submit: vi.fn() }));
vi.mock("./service", () => ({
  getProduct: async () => ({ id: "p", projectId: "d", stage: state.stage }),
  submitRun: (...args: unknown[]) => state.submit(...args),
}));
vi.mock("./run-context", () => ({ loadRunContext: async () => state.context }));

const client = {} as SupabaseClient;
const clients = { client, admin: client };
const who = { brandId: "b", userId: "u" };
const context: RunContext = {
  garmentType: "crew-tee", garmentLabel: "Crew tee", designName: "Tee", sizeRun: ["S", "M", "L"], factoryProfileId: "knitwright-default",
  factoryLabel: "Knitwright default", moq: { status: "set", value: 50 }, ladder: { status: "not-set" }, fabrics: [], releases: [],
};
const body = (over: Partial<RunBody> = {}): RunBody => ({ productId: "p", kind: "run", releaseId: "r", fabricKey: "mesh", quantities: { S: 20, M: "40", L: 0 }, acknowledgeFlags: false, requestKey: "abcdefgh", ...over });

beforeEach(() => {
  state.stage = "run";
  state.context = context;
  state.submit.mockReset().mockResolvedValue({ runId: "run", orderId: "o", status: "submitted", cutoffAt: "x", promisedOn: null, created: true });
});

describe("placeOrder", () => {
  it("sends the cleaned breakdown with the factory from the profile", async () => {
    await placeOrder(clients, who, "owner", body());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "run", factoryProfileId: "knitwright-default", sizes: { S: 20, M: 40 }, flags: [], requestKey: "abcdefgh" }));
  });
  it("refuses a viewer before anything else", async () => {
    await expect(placeOrder(clients, who, "viewer", body())).rejects.toMatchObject({ code: "forbidden" });
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("lets a kit manager order", async () => {
    await expect(placeOrder(clients, who, "kit_manager", body())).resolves.toMatchObject({ created: true });
  });
  it("refuses a run before the product is at the run stage", async () => {
    state.stage = "idea";
    await expect(placeOrder(clients, who, "owner", body())).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("sample first") });
  });
  it("refuses a sample once the product is at the run stage", async () => {
    await expect(placeOrder(clients, who, "owner", body({ kind: "sample", quantities: { S: 1 } }))).rejects.toMatchObject({ code: "conflict" });
  });
  it("sends a sample of one piece per size chosen without flags", async () => {
    state.stage = "idea";
    await placeOrder(clients, who, "owner", body({ kind: "sample", quantities: { S: 1, L: 1 } }));
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "sample", sizes: { S: 1, L: 1 } }));
  });
  it("refuses a size outside the run in plain words", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { XXL: 60 } }))).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining("XXL") });
  });
  it("holds back a run under the minimum until the brand has read the notes", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { M: 10 } }))).rejects.toMatchObject({ code: "conflict", message: FLAGS_NOT_READ });
    expect(state.submit).not.toHaveBeenCalled();
    await placeOrder(clients, who, "owner", body({ quantities: { M: 10 }, acknowledgeFlags: true }));
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ flags: [expect.objectContaining({ code: "under_moq" })] }));
  });
  it("holds back a run over 300 the same way", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { M: 301 } }))).rejects.toMatchObject({ message: FLAGS_NOT_READ });
  });
});
