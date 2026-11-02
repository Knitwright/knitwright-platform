import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockOrders, clearOrders, flagOrders, reviewedAlways, reviewedNever } from "@/lib/moderation/fixtures/gates";
import { start } from "@/lib/garment/fixtures/specs";
import { FLAGS_NOT_READ, placeOrder, UNKNOWN_FABRIC } from "./place-order";
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
  factoryLabel: "Knitwright default", moq: { status: "set", value: 50 }, ladder: { status: "not-set" }, fabrics: ["mesh"], releases: [],
  spec: start("crew-tee"), productionClass: "A",
};

/** The screens every order path now goes through (security review v5 H3, decision 0116). */
const guards = () => ({ order: clearOrders(), humanReview: reviewedAlways() });
const body = (over: Partial<RunBody> = {}): RunBody => ({ productId: "p", kind: "run", releaseId: "r", fabricKey: "mesh", quantities: { S: 20, M: "40", L: 0 }, acknowledgeFlags: false, requestKey: "abcdefgh", ...over });

beforeEach(() => {
  state.stage = "run";
  state.context = context;
  state.submit.mockReset().mockResolvedValue({ runId: "run", orderId: "o", status: "submitted", cutoffAt: "x", promisedOn: null, created: true });
});

describe("placeOrder", () => {
  it("sends the cleaned breakdown with the factory from the profile", async () => {
    await placeOrder(clients, who, "owner", body(), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "run", factoryProfileId: "knitwright-default", sizes: { S: 20, M: 40 }, flags: [], requestKey: "abcdefgh" }));
  });
  it("lets the brand name a fabric when the profile lists none", async () => {
    state.context = { ...context, fabrics: [] };
    await expect(placeOrder(clients, who, "owner", body({ fabricKey: "Mesh 140" }), guards())).resolves.toMatchObject({ created: true });
  });
  it("refuses a fabric the factory profile does not list (security review L7)", async () => {
    await expect(placeOrder(clients, who, "owner", body({ fabricKey: "x".repeat(100) }), guards())).rejects.toMatchObject({ code: "invalid_input", message: UNKNOWN_FABRIC });
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("refuses a viewer before anything else", async () => {
    await expect(placeOrder(clients, who, "viewer", body(), guards())).rejects.toMatchObject({ code: "forbidden" });
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("lets a kit manager order", async () => {
    await expect(placeOrder(clients, who, "kit_manager", body(), guards())).resolves.toMatchObject({ created: true });
  });
  it("refuses a run before the product is at the run stage", async () => {
    state.stage = "idea";
    await expect(placeOrder(clients, who, "owner", body(), guards())).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("sample first") });
  });
  it("refuses a sample once the product is at the run stage", async () => {
    await expect(placeOrder(clients, who, "owner", body({ kind: "sample", quantities: { S: 1 } }), guards())).rejects.toMatchObject({ code: "conflict" });
  });
  it("sends a sample of one piece per size chosen without flags", async () => {
    state.stage = "idea";
    await placeOrder(clients, who, "owner", body({ kind: "sample", quantities: { S: 1, L: 1 } }), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "sample", sizes: { S: 1, L: 1 } }));
  });
  it("refuses a size outside the run in plain words", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { XXL: 60 } }), guards())).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining("XXL") });
  });
  it("holds back a run under the minimum until the brand has read the notes", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { M: 10 } }), guards())).rejects.toMatchObject({ code: "conflict", message: FLAGS_NOT_READ });
    expect(state.submit).not.toHaveBeenCalled();
    await placeOrder(clients, who, "owner", body({ quantities: { M: 10 }, acknowledgeFlags: true }), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ flags: [expect.objectContaining({ code: "under_moq" })] }));
  });
  it("holds back a run over 300 the same way", async () => {
    await expect(placeOrder(clients, who, "owner", body({ quantities: { M: 301 } }), guards())).rejects.toMatchObject({ message: FLAGS_NOT_READ });
  });
});

/**
 * H3 of the v5 security review (decision 0116). `screenBeforeOrder` and `assertHumanReviewed` had
 * no production caller at all, and this is one of the two order paths that now calls both. The spec
 * is explicit: "before every order", and a Class B run needs a person to have looked first (F-G1).
 */
describe("the screens before an order", () => {
  it("screens the design against the release being made, with the design's name as a title", async () => {
    const order = clearOrders();
    await placeOrder(clients, who, "owner", body(), { order, humanReview: reviewedAlways() });

    expect(order.asks).toHaveLength(1);
    expect(order.asks[0]).toMatchObject({ versionId: "r", label: "Tee", classB: false, texts: [{ text: "Tee", context: "title" }] });
  });

  it("refuses the order and writes nothing when the screen blocks it", async () => {
    await expect(placeOrder(clients, who, "owner", body(), { order: blockOrders(), humanReview: reviewedAlways() })).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("lets a flagged order through, because a flag is a person's to look at and not a refusal", async () => {
    await expect(placeOrder(clients, who, "owner", body(), { order: flagOrders(), humanReview: reviewedAlways() })).resolves.toMatchObject({
      created: true,
    });
  });

  it("asks for a person's review of a Class B run, and nobody's for a Class A one", async () => {
    const classB = reviewedAlways();
    state.context = { ...context, productionClass: "B" };
    await placeOrder(clients, who, "owner", body(), { order: clearOrders(), humanReview: classB });
    expect(classB.asked).toEqual(["r"]);

    const classA = reviewedAlways();
    state.context = { ...context, productionClass: "A" };
    await placeOrder(clients, who, "owner", body(), { order: clearOrders(), humanReview: classA });
    expect(classA.asked).toEqual([]);
  });

  it("holds a Class B run nobody has reviewed, and writes nothing", async () => {
    state.context = { ...context, productionClass: "B" };
    await expect(placeOrder(clients, who, "owner", body(), { order: clearOrders(), humanReview: reviewedNever() })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("review queue"),
    });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("screens after the cheap refusals, so a person is told the easy things first", async () => {
    const order = clearOrders();
    await expect(placeOrder(clients, who, "owner", body({ fabricKey: "not-a-fabric" }), { order, humanReview: reviewedAlways() })).rejects.toMatchObject({
      message: UNKNOWN_FABRIC,
    });
    expect(order.asks).toEqual([]);
  });
});
