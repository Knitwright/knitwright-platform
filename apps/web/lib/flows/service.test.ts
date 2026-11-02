import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { PRESETS } from "./fixtures/canvas";
import {
  applyFlowTemplate,
  finishFlowRun,
  latestFlowRun,
  publishFlowListing,
  refundFlowSpend,
  reportOf,
  setFlowRunBoard,
  spendFlowOutput,
  startFlowRun,
} from "./service";
import { LISTING_KIND, LISTING_NOTE, type ListingPayload } from "./listing";
import { FLOW_GAP_RULE } from "./types";

/**
 * The flow tables (migration 20261201030000). Reads go through the client the caller passes; every
 * write goes through one of that migration's functions, with the brand and the person from the
 * session.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const CANVAS = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const BOARD = "55555555-5555-4555-8555-555555555555";
const FILE = "66666666-6666-4666-8666-666666666666";
const ENTRY = "77777777-7777-4777-8777-777777777777";
const B1 = "99999999-9999-4999-8999-999999999999";
const B2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const who = { brandId: BRAND, userId: USER };

const argsOf = (calls: readonly { steps: readonly (readonly [string, readonly unknown[]])[] }[], at = 0) =>
  (calls[at]?.steps.find(([name]) => name === "args")?.[1][0] ?? {}) as Record<string, unknown>;

const failing = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "nothing was thrown";
  } catch (error) {
    return (error as Error).message;
  }
};

describe("opening a flow template on a canvas", () => {
  const answers = {
    save_launch_board: { data: BOARD },
    connect_launch_boards: { data: "88888888-8888-4888-8888-888888888888" },
  };

  it("adds every board of the pack and then every connector, through L1's own functions", async () => {
    const { client, calls } = fakeClient(answers);
    const applied = await applyFlowTemplate(client, who, {
      launchProjectId: CANVAS,
      template: "sponsor-pack",
      designProjectId: CANVAS,
      designVersion: 2,
      presets: PRESETS,
    });

    expect(applied.plan.assets).toBe(4);
    expect(Object.keys(applied.boardIds)).toHaveLength(5);
    expect(calls.filter((call) => call.name === "save_launch_board")).toHaveLength(5);
    expect(calls.filter((call) => call.name === "connect_launch_boards")).toHaveLength(4);
    // The boards all go in before the first connector, because a connector names two of them.
    expect(calls.findIndex((call) => call.name === "connect_launch_boards")).toBe(5);
  });

  it("writes the design and the version on the Design board, so the garment is locked at once", async () => {
    const { client, calls } = fakeClient(answers);
    await applyFlowTemplate(client, who, {
      launchProjectId: CANVAS,
      template: "sponsor-pack",
      designProjectId: CANVAS,
      designVersion: 2,
      presets: PRESETS,
    });

    expect(argsOf(calls)).toMatchObject({
      p_brand_id: BRAND,
      p_user_id: USER,
      p_kind: "design",
      p_input_version: 2,
      p_settings: expect.objectContaining({ designProjectId: CANVAS, flowTemplate: "sponsor-pack" }),
    });
  });

  it("opens the A4 poster at the print size of the artboard row", async () => {
    const { client, calls } = fakeClient(answers);
    await applyFlowTemplate(client, who, { launchProjectId: CANVAS, template: "sponsor-pack", designProjectId: null, designVersion: null, presets: PRESETS });
    const poster = calls.filter((call) => call.name === "save_launch_board").map((call, at) => ({ at, args: argsOf([call]) })).find(({ args }) => args["p_name"] === "A4 poster");

    expect(poster?.args).toMatchObject({ p_width: 2480, p_height: 3508 });
  });

  it("refuses a pack that does not exist", async () => {
    const { client } = fakeClient(answers);

    expect(await failing(applyFlowTemplate(client, who, { launchProjectId: CANVAS, template: "made-up", designProjectId: null, designVersion: null, presets: PRESETS }))).toContain(
      "That flow template does not exist",
    );
  });
});

describe("a run", () => {
  it("is started with the estimate that was shown before it", async () => {
    const { client, calls } = fakeClient({ start_flow_run: { data: RUN } });

    expect(await startFlowRun(client, who, { launchProjectId: CANVAS, scope: "all", fromBoardId: null, estimateCredits: 3, template: "club-kit-launch-pack" })).toBe(RUN);
    expect(argsOf(calls)).toEqual({
      p_brand_id: BRAND,
      p_user_id: USER,
      p_launch_project_id: CANVAS,
      p_scope: "all",
      p_from_board_id: null,
      p_estimate_credits: 3,
      p_template_slug: "club-kit-launch-pack",
    });
  });

  it("records a board with its place in the order, its cost and its refund", async () => {
    const { client, calls } = fakeClient({ set_flow_run_board: { data: RUN } });
    await setFlowRunBoard(client, who, {
      runId: RUN,
      boardId: BOARD,
      position: 4,
      status: "failed",
      credits: 0,
      refunded: 1,
      spendEntryId: ENTRY,
      assets: 1,
      format: "png",
      outputFileId: null,
      reason: "The picture did not come back.",
    });

    expect(argsOf(calls)).toMatchObject({ p_position: 4, p_status: "failed", p_refunded: 1, p_spend_entry_id: ENTRY, p_output_file_id: null });
  });

  it("is closed with what it spent after refunds", async () => {
    const { client, calls } = fakeClient({ finish_flow_run: { data: RUN } });
    await finishFlowRun(client, who, { runId: RUN, status: "part_done", spent: 2, refunded: 1, assets: 10 });

    expect(argsOf(calls)).toMatchObject({ p_status: "part_done", p_spent: 2, p_refunded: 1, p_assets: 10 });
  });

  it("says plainly when the run is gone", async () => {
    const { client } = fakeClient({ finish_flow_run: { error: { message: "no", hint: "flow_run_not_found" } } });

    expect(await failing(finishFlowRun(client, who, { runId: RUN, status: "done", spent: 0, refunded: 0, assets: 1 }))).toBeTruthy();
  });
});

describe("the money", () => {
  it("charges one board at a time, keyed by the design version and the board", async () => {
    const { client, calls } = fakeClient({ credit_spend_output: { data: { ok: true, charged: true, price: 2, balance: 8, entry_id: ENTRY } } });
    const outcome = await spendFlowOutput(client, { brandId: BRAND, userId: USER, designVersionHash: "hash", outputKey: BOARD });

    expect(outcome).toEqual({ ok: true, charged: true, price: 2, balance: 8, entryId: ENTRY });
    expect(argsOf(calls)).toEqual({
      p_brand_id: BRAND,
      p_user_id: USER,
      p_kind: "marketing_media",
      p_version_hash: "hash",
      p_output_key: BOARD,
      p_usage_event_id: null,
    });
  });

  it("says when the balance is short, without spending anything", async () => {
    const { client } = fakeClient({ credit_spend_output: { data: { ok: false, reason: "insufficient", price: 4, balance: 1 } } });

    expect(await spendFlowOutput(client, { brandId: BRAND, userId: USER, designVersionHash: "hash", outputKey: BOARD })).toEqual({ ok: false, price: 4, balance: 1 });
  });

  it("gives back one charge, and reads how much came back", async () => {
    const { client, calls } = fakeClient({ credit_refund_spend: { data: { refunded: 2, balance: 10 } } });

    expect(await refundFlowSpend(client, BRAND, ENTRY, "A flow board did not finish")).toBe(2);
    expect(argsOf(calls)).toEqual({ p_brand_id: BRAND, p_entry_id: ENTRY, p_note: "A flow board did not finish" });
  });
});

describe("the listing hand-off", () => {
  const payload: ListingPayload = {
    kind: LISTING_KIND,
    payloadVersion: 1,
    launchProjectId: CANVAS,
    title: "Home kit",
    designProjectId: CANVAS,
    designVersion: 3,
    media: [],
    note: LISTING_NOTE,
    ruleId: FLOW_GAP_RULE,
  };

  it("writes the payload for the Store to collect, and nothing else", async () => {
    const { client, calls } = fakeClient({ publish_flow_listing: { data: RUN } });

    expect(await publishFlowListing(client, who, CANVAS, payload)).toBe(RUN);
    expect(argsOf(calls)).toMatchObject({ p_launch_project_id: CANVAS, p_payload: payload });
  });

  it("refuses when the canvas is gone", async () => {
    const { client } = fakeClient({ publish_flow_listing: { error: { message: "no", hint: "launch_project_not_found" } } });

    expect(await failing(publishFlowListing(client, who, CANVAS, payload))).toBeTruthy();
  });
});

describe("reading the last run back", () => {
  const runRow = (over: Record<string, unknown> = {}) => ({
    id: RUN,
    scope: "all",
    from_board_id: null,
    status: "part_done",
    estimate_credits: 3,
    spent_credits: 2,
    refunded_credits: 1,
    assets: 10,
    template_slug: "club-kit-launch-pack",
    created_at: "2026-12-01T10:00:00Z",
    finished_at: "2026-12-01T10:02:00Z",
    flow_run_boards: [
      { board_id: B2, position: 2, status: "failed", credits: 0, refunded_credits: 1, assets: 1, format: "png", output_file_id: null, reason: "It did not come back.", rule_id: "R-GAP-000" },
      { board_id: B1, position: 1, status: "ready", credits: 1, refunded_credits: 0, assets: 1, format: "png", output_file_id: FILE, reason: null, rule_id: "R-GAP-000" },
    ],
    ...over,
  });

  const names = new Map([
    [B1, { name: "Front render", kind: "mockup" as const }],
    [B2, { name: "Team line-up (11)", kind: "ai_image" as const }],
  ]);

  it("gives the boards in the order they ran, with the names from the canvas", async () => {
    const { client } = fakeClient({ flow_runs: { data: runRow() } });
    const run = await latestFlowRun(client, BRAND, CANVAS, names);

    expect(run?.report.lines.map((line) => line.boardId)).toEqual([B1, B2]);
    expect(run?.report.lines[0]).toMatchObject({ name: "Front render", state: "ready", fileId: FILE });
    expect(run?.report.lines[1]).toMatchObject({ name: "Team line-up (11)", state: "failed", refunded: 1 });
    expect(run?.report).toMatchObject({ state: "part_done", spent: 2, refunded: 1, assets: 10 });
  });

  it("reads one brand's own canvas, newest run first", async () => {
    const { client, calls } = fakeClient({ flow_runs: { data: runRow() } });
    await latestFlowRun(client, BRAND, CANVAS, names);
    const steps = calls[0]?.steps.map(([name, args]) => [name, args]) ?? [];

    expect(steps).toEqual([
      ["select", [expect.stringContaining("flow_run_boards(")]],
      ["eq", ["brand_id", BRAND]],
      ["eq", ["launch_project_id", CANVAS]],
      ["order", ["created_at", { ascending: false }]],
      ["limit", [1]],
      ["maybeSingle", []],
    ]);
  });

  it("gives nothing when the canvas has never been run", async () => {
    const { client } = fakeClient({ flow_runs: { data: null } });

    expect(await latestFlowRun(client, BRAND, CANVAS, names)).toBeNull();
  });

  it("will not read a row it does not recognise, rather than guessing at it", async () => {
    const { client } = fakeClient({ flow_runs: { data: { ...runRow(), status: "invented" } } });

    expect(await failing(latestFlowRun(client, BRAND, CANVAS, names))).toBeTruthy();
  });

  it("names a board the canvas no longer has, rather than falling over", async () => {
    const { client } = fakeClient({ flow_runs: { data: runRow() } });
    const run = await latestFlowRun(client, BRAND, CANVAS, new Map());

    expect(run?.report.lines[0]).toMatchObject({ name: "", kind: "mockup" });
  });

  it("joins a saved run to the estimate the summary wants", async () => {
    const { client } = fakeClient({ flow_runs: { data: runRow() } });
    const run = await latestFlowRun(client, BRAND, CANVAS, names);
    const estimate = { lines: [], credits: 3, assets: 14, blocked: 0, note: "n", ruleId: FLOW_GAP_RULE };

    expect(reportOf(run!, estimate)).toMatchObject({ state: "part_done", estimate, assets: 10 });
  });

  it("gives up plainly when the run cannot be read", async () => {
    const { client } = fakeClient({ flow_runs: { error: { message: "gone" } } });

    expect(await failing(latestFlowRun(client, BRAND, CANVAS, names))).toBeTruthy();
  });
});
