import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockOrders, clearOrders, flagOrders, reviewedAlways, reviewedNever } from "@/lib/moderation/fixtures/gates";
import { start } from "@/lib/garment/fixtures/specs";
import type { ClubRole } from "@/lib/clubs/roles";
import type { OrderValidationGate } from "@/lib/make/order-gate";
import type { OrderGuards } from "@/lib/moderation/before-order";
import { AppError } from "@/lib/server/core/errors";
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
/** The validation gate (plan v6 D1): runs the screen it is given, as the real one does, and carries `checklist`. */
const gateState = { refuse: false, checklist: [] as { code: string; text: string }[], asked: [] as unknown[] };
const gate: OrderValidationGate = async (order, screen) => {
  gateState.asked.push(order);
  if (gateState.refuse) throw new AppError("conflict", "This design has 1 blocker against the factory profile.");
  await screen();
  return gateState.checklist;
};
const place = (role: ClubRole, sent: RunBody, guarded: OrderGuards) => placeOrder(clients, who, role, sent, guarded, gate);
const body = (over: Partial<RunBody> = {}): RunBody => ({ productId: "p", kind: "run", releaseId: "r", fabricKey: "mesh", quantities: { S: 20, M: "40", L: 0 }, acknowledgeFlags: false, requestKey: "abcdefgh", ...over });

beforeEach(() => {
  state.stage = "run";
  state.context = context;
  state.submit.mockReset().mockResolvedValue({ runId: "run", orderId: "o", status: "submitted", cutoffAt: "x", promisedOn: null, created: true });
});

describe("placeOrder", () => {
  it("sends the cleaned breakdown with the factory from the profile", async () => {
    await place("owner", body(), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "run", factoryProfileId: "knitwright-default", sizes: { S: 20, M: 40 }, flags: [], requestKey: "abcdefgh" }));
  });
  it("lets the brand name a fabric when the profile lists none", async () => {
    state.context = { ...context, fabrics: [] };
    await expect(place("owner", body({ fabricKey: "Mesh 140" }), guards())).resolves.toMatchObject({ created: true });
  });
  it("refuses a fabric the factory profile does not list (security review L7)", async () => {
    await expect(place("owner", body({ fabricKey: "x".repeat(100) }), guards())).rejects.toMatchObject({ code: "invalid_input", message: UNKNOWN_FABRIC });
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("refuses a viewer before anything else", async () => {
    await expect(place("viewer", body(), guards())).rejects.toMatchObject({ code: "forbidden" });
    expect(state.submit).not.toHaveBeenCalled();
  });
  it("lets a kit manager order", async () => {
    await expect(place("kit_manager", body(), guards())).resolves.toMatchObject({ created: true });
  });
  it("refuses a run before the product is at the run stage", async () => {
    state.stage = "idea";
    await expect(place("owner", body(), guards())).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("sample first") });
  });
  it("refuses a sample once the product is at the run stage", async () => {
    await expect(place("owner", body({ kind: "sample", quantities: { S: 1 } }), guards())).rejects.toMatchObject({ code: "conflict" });
  });
  it("sends a sample of one piece per size chosen without flags", async () => {
    state.stage = "idea";
    await place("owner", body({ kind: "sample", quantities: { S: 1, L: 1 } }), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ kind: "sample", sizes: { S: 1, L: 1 } }));
  });
  it("refuses a size outside the run in plain words", async () => {
    await expect(place("owner", body({ quantities: { XXL: 60 } }), guards())).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining("XXL") });
  });
  it("holds back a run under the minimum until the brand has read the notes", async () => {
    await expect(place("owner", body({ quantities: { M: 10 } }), guards())).rejects.toMatchObject({ code: "conflict", message: FLAGS_NOT_READ });
    expect(state.submit).not.toHaveBeenCalled();
    await place("owner", body({ quantities: { M: 10 }, acknowledgeFlags: true }), guards());
    expect(state.submit).toHaveBeenCalledWith(client, who, expect.objectContaining({ flags: [expect.objectContaining({ code: "under_moq" })] }));
  });
  it("holds back a run over 300 the same way", async () => {
    await expect(place("owner", body({ quantities: { M: 301 } }), guards())).rejects.toMatchObject({ message: FLAGS_NOT_READ });
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
    await place("owner", body(), { order, humanReview: reviewedAlways() });

    expect(order.asks).toHaveLength(1);
    expect(order.asks[0]).toMatchObject({ versionId: "r", label: "Tee", classB: false, texts: [{ text: "Tee", context: "title" }] });
  });

  it("refuses the order and writes nothing when the screen blocks it", async () => {
    await expect(place("owner", body(), { order: blockOrders(), humanReview: reviewedAlways() })).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("lets a flagged order through, because a flag is a person's to look at and not a refusal", async () => {
    await expect(place("owner", body(), { order: flagOrders(), humanReview: reviewedAlways() })).resolves.toMatchObject({
      created: true,
    });
  });

  it("asks for a person's review of a Class B run, and nobody's for a Class A one", async () => {
    const classB = reviewedAlways();
    state.context = { ...context, productionClass: "B" };
    await place("owner", body(), { order: clearOrders(), humanReview: classB });
    expect(classB.asked).toEqual(["r"]);

    const classA = reviewedAlways();
    state.context = { ...context, productionClass: "A" };
    await place("owner", body(), { order: clearOrders(), humanReview: classA });
    expect(classA.asked).toEqual([]);
  });

  it("holds a Class B run nobody has reviewed, and writes nothing", async () => {
    state.context = { ...context, productionClass: "B" };
    await expect(place("owner", body(), { order: clearOrders(), humanReview: reviewedNever() })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("review queue"),
    });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("screens after the cheap refusals, so a person is told the easy things first", async () => {
    const order = clearOrders();
    await expect(place("owner", body({ fabricKey: "not-a-fabric" }), { order, humanReview: reviewedAlways() })).rejects.toMatchObject({
      message: UNKNOWN_FABRIC,
    });
    expect(order.asks).toEqual([]);
  });
});

/**
 * Plan v6 D1 (decision 0132; spec F-0): the version's own checks and the F-G2 checklist run before every brand run,
 * and a blocker in the checks refuses the order before anything is screened or written.
 */
describe("the validation gate before an order", () => {
  beforeEach(() => {
    gateState.refuse = false;
    gateState.checklist = [];
    gateState.asked = [];
  });

  it("asks about the release being made, with the design and its production class", async () => {
    state.context = { ...context, productionClass: "B" };
    await place("owner", body(), guards());
    expect(gateState.asked).toEqual([{ projectId: "d", releaseId: "r", productionClass: "B", colourToleranceMax: null }]);
  });

  it("refuses a design whose checks hold a blocker, and neither screens nor writes", async () => {
    gateState.refuse = true;
    const order = clearOrders();
    await expect(place("owner", body(), { order, humanReview: reviewedAlways() })).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("blocker") });
    expect(order.asks).toEqual([]);
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("carries the checklist's findings to ops after the quantity's own notes", async () => {
    gateState.checklist = [{ code: "pre_export_check", text: "2 things to put right before this can go to a factory." }];
    await place("owner", body({ quantities: { M: 10 }, acknowledgeFlags: true }), guards());
    const sent = state.submit.mock.calls[0]?.[2] as { flags: { code: string }[] };
    expect(sent.flags.map((flag) => flag.code)).toEqual(["under_moq", "pre_export_check"]);
  });

  it("does not ask the brand to read the checklist's notes as it does the quantity's", async () => {
    gateState.checklist = [{ code: "pre_export_check", text: "Notes." }];
    await expect(place("owner", body(), guards())).resolves.toMatchObject({ created: true });
  });

  it("is asked after the cheap refusals", async () => {
    await expect(place("owner", body({ fabricKey: "not-a-fabric" }), guards())).rejects.toMatchObject({ message: UNKNOWN_FABRIC });
    expect(gateState.asked).toEqual([]);
  });
});
