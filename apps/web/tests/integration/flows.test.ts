import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Flows: the runs, the hand-offs and the templates (plan v5 L6, spec F-L4; decision 0096), against
 * local Supabase. Needs `pnpm db:start`.
 *
 * What the database itself must hold:
 *   * **artwork never comes through a board a model drew.** L1 refuses a generated board's own
 *     output as artwork; a Marketing board fed by an AI Image board gets past that check, because
 *     the check asks about one board's kind. The flow migration's trigger asks the whole branch, so
 *     a four-hop chain cannot launder a generated picture into a print file (spec decision 13).
 *   * only the flow functions write a run, a run's boards or a listing hand-off, and each refuses a
 *     role that may not;
 *   * a listing hand-off is append-only: it can be marked collected and changed in no other way;
 *   * one board's charge is given back on its own, and only once;
 *   * the six packs of `07` are seeded with their steps and their connectors, and a step cannot sit
 *     under a section its own pack does not have.
 *
 * Every canvas takes its own name, because a brand may hold only one canvas of a given name and two
 * tests that shared one would land on each other's rows (plan v5, lesson 11).
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const canvasName = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((one) => one.brand_id === brandId);
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const makeCanvas = async (who: Person, brandId: string, label = "Flow"): Promise<string> =>
  must(await rpc("create_launch_project", { p_brand_id: brandId, p_user_id: who.userId, p_name: canvasName(label), p_units: "px", p_design_project_id: null })) as string;

const makeBoard = async (who: Person, brandId: string, canvasId: string, kind: string, over: Record<string, unknown> = {}): Promise<string> =>
  must(await rpc("save_launch_board", {
    p_brand_id: brandId, p_user_id: who.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: kind,
    p_name: kind, p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: {}, p_input_version: 1, ...over,
  })) as string;

const connect = (who: Person, brandId: string, from: string, to: string, index = 1) =>
  rpc("connect_launch_boards", { p_brand_id: brandId, p_user_id: who.userId, p_from_board_id: from, p_to_board_id: to, p_input_index: index });

const setOutput = (who: Person, brandId: string, boardId: string, over: Record<string, unknown> = {}) =>
  rpc("set_launch_board_output", {
    p_brand_id: brandId, p_user_id: who.userId, p_board_id: boardId, p_output_file_id: null,
    p_output_role: "asset", p_status: "ready", p_last_cost_credits: 0, ...over,
  });

const startRun = (who: Person, brandId: string, canvasId: string, over: Record<string, unknown> = {}) =>
  rpc("start_flow_run", {
    p_brand_id: brandId, p_user_id: who.userId, p_launch_project_id: canvasId, p_scope: "all",
    p_from_board_id: null, p_estimate_credits: 3, p_template_slug: null, ...over,
  });

const setRunBoard = (who: Person, brandId: string, runId: string, boardId: string, over: Record<string, unknown> = {}) =>
  rpc("set_flow_run_board", {
    p_brand_id: brandId, p_user_id: who.userId, p_run_id: runId, p_board_id: boardId, p_position: 1,
    p_status: "ready", p_credits: 0, p_refunded: 0, p_spend_entry_id: null, p_assets: 1, p_format: "png",
    p_output_file_id: null, p_reason: null, ...over,
  });

const payload = (over: Record<string, unknown> = {}) => ({ kind: "launch-listing", payloadVersion: 1, media: [], ...over });

let ann: Person;
let ben: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, viewer] = await Promise.all([person("flow-ann"), person("flow-ben"), person("flow-viewer")]);
  annBrand = await brandOf(ann, "Ann Flows");
  benBrand = await brandOf(ben, "Ben Flows");
  await join(ann, annBrand, viewer, "viewer");
});

describe("a four-hop flow trying to make a generated picture into artwork", () => {
  /** Design -> Mockup -> AI image -> AI image -> Marketing, every hop one the spec allows. */
  const chain = async (): Promise<Record<string, string>> => {
    const canvasId = await makeCanvas(ann, annBrand, "Chain");
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const again = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const post = await makeBoard(ann, annBrand, canvasId, "marketing");
    must(await connect(ann, annBrand, design, mockup));
    must(await connect(ann, annBrand, mockup, scene));
    must(await connect(ann, annBrand, scene, again));
    must(await connect(ann, annBrand, again, post));
    return { canvasId, design, mockup, scene, again, post };
  };

  it("is refused at the last hop, four boards away from the AI board", async () => {
    const boards = await chain();

    for (const role of ["panel_layer", "print_file"]) {
      const refused = await setOutput(ann, annBrand, boards["post"] as string, { p_output_role: role });
      expect(refused.error?.hint, role).toBe("generated_is_never_artwork");
    }
  });

  it("still lets that post hold the picture as an asset, which is what the spec asks for", async () => {
    const boards = await chain();
    must(await setOutput(ann, annBrand, boards["post"] as string));
    const row = must(await ann.client.from("boards").select("status, output_role").eq("id", boards["post"]).single());

    expect(row).toEqual({ status: "ready", output_role: "asset" });
  });

  it("lets a board with nothing generated behind it be artwork", async () => {
    const boards = await chain();
    must(await setOutput(ann, annBrand, boards["mockup"] as string, { p_output_role: "print_file" }));
    const row = must(await ann.client.from("boards").select("output_role").eq("id", boards["mockup"]).single());

    expect(row).toEqual({ output_role: "print_file" });
  });

  it("refuses the same row written straight past the function", async () => {
    const boards = await chain();
    const refused = await adminClient().from("boards").update({ output_role: "print_file" }).eq("id", boards["post"]);

    expect(refused.error).not.toBeNull();
  });

  it("refuses a connector that would put a model's picture behind a board already used as artwork", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Later");
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const post = await makeBoard(ann, annBrand, canvasId, "marketing");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, mockup));
    must(await connect(ann, annBrand, mockup, post));
    must(await connect(ann, annBrand, design, scene));
    // Allowed: nothing a model made is behind this post yet.
    must(await setOutput(ann, annBrand, post, { p_output_role: "print_file" }));
    // Refused: the connector would put one behind it, and the board's own row never changes, so the
    // trigger on `boards` could not see this coming.
    const refused = await connect(ann, annBrand, scene, post, 2);

    expect(refused.error?.hint).toBe("generated_is_never_artwork");
  });

  it("refuses a board becoming a model scene behind a board already used as artwork", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Settings");
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const post = await makeBoard(ann, annBrand, canvasId, "marketing");
    must(await connect(ann, annBrand, design, mockup));
    must(await connect(ann, annBrand, mockup, post));
    must(await setOutput(ann, annBrand, post, { p_output_role: "print_file" }));
    // A board says in its own settings that a model made its picture, and settings can be saved
    // after an output has been recorded, so the trigger watches them too.
    const refused = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: mockup, p_kind: "mockup",
      p_name: "mockup", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: { generation: "model" }, p_input_version: 1,
    });

    expect(refused.error?.hint).toBe("generated_is_never_artwork");
  });

  it("counts a board a flow template marked as a model scene as generated too", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Marked");
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const scene = await makeBoard(ann, annBrand, canvasId, "mockup", { p_settings: { generation: "model", scene: "team-line-up-11" } });
    const post = await makeBoard(ann, annBrand, canvasId, "marketing");
    must(await connect(ann, annBrand, design, scene));
    must(await connect(ann, annBrand, scene, post));

    expect((await setOutput(ann, annBrand, post, { p_output_role: "print_file" })).error?.hint).toBe("generated_is_never_artwork");
  });
});

describe("a flow run", () => {
  it("is written with the estimate that was shown, and closed with what it really spent", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Run");
    const board = await makeBoard(ann, annBrand, canvasId, "mockup");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;
    must(await setRunBoard(ann, annBrand, runId, board, { p_status: "failed", p_credits: 0, p_refunded: 1, p_reason: "It did not come back." }));
    must(await rpc("finish_flow_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_run_id: runId, p_status: "part_done", p_spent: 2, p_refunded: 1, p_assets: 10 }));
    const row = must(await ann.client.from("flow_runs").select("status, estimate_credits, spent_credits, refunded_credits, assets, finished_at").eq("id", runId).single()) as Record<string, unknown>;
    const boards = must(await ann.client.from("flow_run_boards").select("status, credits, refunded_credits, reason").eq("run_id", runId)) as Record<string, unknown>[];

    expect(row).toMatchObject({ status: "part_done", estimate_credits: 3, spent_credits: 2, refunded_credits: 1, assets: 10 });
    expect(row["finished_at"]).not.toBeNull();
    expect(boards).toEqual([{ status: "failed", credits: 0, refunded_credits: 1, reason: "It did not come back." }]);
  });

  it("records one row per board of a run, and changes it when the board finishes", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Again");
    const board = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;
    must(await setRunBoard(ann, annBrand, runId, board, { p_status: "running" }));
    must(await setRunBoard(ann, annBrand, runId, board, { p_status: "ready", p_credits: 1 }));
    const boards = must(await ann.client.from("flow_run_boards").select("status, credits, kind").eq("run_id", runId)) as Record<string, unknown>[];

    // The kind is kept on the run's own row, so a board removed later still reads back as itself.
    expect(boards).toEqual([{ status: "ready", credits: 1, kind: "ai_image" }]);
  });

  it("lets a board go and takes its line of the run with it, while the run itself stays", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Gone");
    const board = await makeBoard(ann, annBrand, canvasId, "ai_video");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;
    must(await setRunBoard(ann, annBrand, runId, board, { p_status: "ready" }));
    must(await rpc("remove_launch_board", { p_brand_id: annBrand, p_user_id: ann.userId, p_board_id: board }));

    // A line of a run is about a board, so it goes when the board goes. What the money did is not
    // in this table at all: the credit ledger keeps that, and it is append-only.
    expect(must(await ann.client.from("flow_run_boards").select("kind").eq("run_id", runId))).toEqual([]);
    expect(must(await ann.client.from("flow_runs").select("id").eq("id", runId))).toHaveLength(1);
  });

  it("refuses a board that was skipped being charged for, and records a refund that could not be made", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Honest");
    const board = await makeBoard(ann, annBrand, canvasId, "mockup");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;

    // A skipped board is one no model was ever asked for, so there is nothing to charge.
    expect((await setRunBoard(ann, annBrand, runId, board, { p_status: "skipped", p_credits: 2 })).error).not.toBeNull();
    // A failed board normally keeps nothing, but a refund that itself failed has to be recordable:
    // the truth about money is worth more than a constraint that would hide it.
    must(await setRunBoard(ann, annBrand, runId, board, { p_status: "failed", p_credits: 2, p_refunded: 0 }));
    const row = must(await ann.client.from("flow_run_boards").select("credits, refunded_credits").eq("run_id", runId).single());

    expect(row).toEqual({ credits: 2, refunded_credits: 0 });
  });

  it("refuses a run closed as still running, which would say it had finished at a time it had not", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Open");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;

    expect((await rpc("finish_flow_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_run_id: runId, p_status: "running", p_spent: 0, p_refunded: 0, p_assets: 0 })).error?.hint).toBe("run_not_finished");
  });

  it("refuses a run started from a board of another canvas", async () => {
    const mine = await makeCanvas(ann, annBrand, "Mine");
    const other = await makeCanvas(ann, annBrand, "Other");
    const board = await makeBoard(ann, annBrand, other, "mockup");

    expect((await startRun(ann, annBrand, mine, { p_from_board_id: board, p_scope: "board" })).error?.hint).toBe("board_not_found");
  });

  it("is refused to a viewer, to another brand's canvas and to a board that is gone", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Guarded");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;

    expect((await startRun(viewer, annBrand, canvasId)).error?.code).toBe("42501");
    expect((await startRun(ben, benBrand, canvasId)).error?.hint).toBe("launch_project_not_found");
    expect((await setRunBoard(ann, annBrand, runId, randomUUID())).error?.hint).toBe("board_not_found");
    expect((await rpc("finish_flow_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_run_id: randomUUID(), p_status: "done", p_spent: 0, p_refunded: 0, p_assets: 0 })).error?.hint).toBe("flow_run_not_found");
  });

  it("cannot be written or changed straight past the functions", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Direct");
    const runId = must(await startRun(ann, annBrand, canvasId)) as string;

    expect((await adminClient().from("flow_runs").insert({ brand_id: annBrand, launch_project_id: canvasId, scope: "all" })).error).not.toBeNull();
    expect((await adminClient().from("flow_runs").update({ assets: 99 }).eq("id", runId)).error).not.toBeNull();
    expect((await ben.client.from("flow_runs").select("id").eq("id", runId)).data).toEqual([]);
  });
});

describe("a listing hand-off", () => {
  it("is written for the Store to collect, and says nothing about money", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Listing");
    const id = must(await rpc("publish_flow_listing", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_payload: payload({ title: "Home kit" }) })) as string;
    const row = must(await ann.client.from("flow_listings").select("payload, collected_at").eq("id", id).single()) as Record<string, unknown>;

    expect((row["payload"] as Record<string, unknown>)["kind"]).toBe("launch-listing");
    expect(row["collected_at"]).toBeNull();
    expect(Object.keys(row["payload"] as Record<string, unknown>)).not.toContain("price");
  });

  it("refuses a payload that is not a listing, a viewer and another brand's canvas", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Refused");

    expect((await rpc("publish_flow_listing", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_payload: { kind: "something else" } })).error?.hint).toBe("not_a_listing");
    expect((await rpc("publish_flow_listing", { p_brand_id: annBrand, p_user_id: viewer.userId, p_launch_project_id: canvasId, p_payload: payload() })).error?.code).toBe("42501");
    expect((await rpc("publish_flow_listing", { p_brand_id: benBrand, p_user_id: ben.userId, p_launch_project_id: canvasId, p_payload: payload() })).error?.hint).toBe("launch_project_not_found");
  });

  it("can be marked collected, by the one function that may, and changed in no other way", async () => {
    const canvasId = await makeCanvas(ann, annBrand, "Collected");
    const id = must(await rpc("publish_flow_listing", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_payload: payload() })) as string;

    // Nobody holds UPDATE or DELETE on the table, so both of these are refused before any trigger.
    expect((await adminClient().from("flow_listings").update({ payload: payload({ changed: true }) }).eq("id", id)).error).not.toBeNull();
    expect((await adminClient().from("flow_listings").delete().eq("id", id)).error).not.toBeNull();
    expect((await adminClient().from("flow_listings").update({ collected_at: new Date().toISOString() }).eq("id", id)).error).not.toBeNull();

    // The Store collecting it. The second call says the same thing about the same hand-off.
    const first = must(await rpc("collect_flow_listing", { p_listing_id: id })) as string;
    const again = must(await rpc("collect_flow_listing", { p_listing_id: id })) as string;

    expect(first).not.toBeNull();
    expect(again).toBe(first);
    expect((await rpc("collect_flow_listing", { p_listing_id: randomUUID() })).error?.hint).toBe("listing_not_found");
  });

  it("is collected by nobody in a browser, however it asks", async () => {
    expect((await ann.client.rpc("collect_flow_listing", { p_listing_id: randomUUID() })).error).not.toBeNull();
  });
});

describe("the credits of one board", () => {
  const hash = () => `flow-${randomUUID()}`;

  it("are charged once per board and given back one charge at a time", async () => {
    const version = hash();
    const first = must(await rpc("credit_grant", { p_brand_id: annBrand, p_amount: 20, p_key: `flow-grant-${randomUUID()}`, p_note: "Flow test" }));
    expect(first).not.toBeNull();

    const one = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "board-one" })) as Record<string, unknown>;
    const two = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "board-two" })) as Record<string, unknown>;

    expect([one["ok"], one["charged"]]).toEqual([true, true]);
    expect([two["ok"], two["charged"]]).toEqual([true, true]);
    expect(one["entry_id"]).not.toBe(two["entry_id"]);

    const again = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "board-one" })) as Record<string, unknown>;
    expect(again["charged"]).toBe(false);
    expect(again["entry_id"]).toBe(one["entry_id"]);

    const back = must(await rpc("credit_refund_spend", { p_brand_id: annBrand, p_entry_id: one["entry_id"], p_note: "A flow board did not finish" })) as Record<string, unknown>;
    const twice = must(await rpc("credit_refund_spend", { p_brand_id: annBrand, p_entry_id: one["entry_id"], p_note: "A flow board did not finish" })) as Record<string, unknown>;

    expect(Number(back["refunded"])).toBeGreaterThan(0);
    expect(Number(twice["refunded"])).toBe(0);
  });

  it("name the plain design version, so the refund when a design is ordered still covers them", async () => {
    const version = hash();
    must(await rpc("credit_grant", { p_brand_id: annBrand, p_amount: 20, p_key: `flow-grant-${randomUUID()}`, p_note: "Flow test" }));
    must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "board-three" }));
    const swept = must(await rpc("credit_refund_for_order", { p_brand_id: annBrand, p_version_hash: version })) as Record<string, unknown>;

    expect(Number(swept["refunded"])).toBeGreaterThan(0);
  });

  it("are refused a key that is not a key, an output nobody priced, and a viewer", async () => {
    expect((await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: "", p_output_key: "board" })).error).not.toBeNull();
    expect((await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "invented", p_version_hash: "hash", p_output_key: "board" })).error).not.toBeNull();
    // Spending a brand's credits asks for the ability to change its kit, so a viewer cannot run up
    // a bill. `credit_spend` asked only for membership until the v5 security review's H4; migration
    // 20261215020000 brought it into line, and credits.test.ts holds it there.
    expect((await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: viewer.userId, p_kind: "marketing_media", p_version_hash: "hash", p_output_key: "board" })).error?.code).toBe("42501");
  });

  it("charge again for a fresh run after a refund, rather than letting the second attempt be free", async () => {
    const version = hash();
    must(await rpc("credit_grant", { p_brand_id: annBrand, p_amount: 20, p_key: `flow-grant-${randomUUID()}`, p_note: "Flow test" }));
    const first = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "run-one:board" })) as Record<string, unknown>;
    must(await rpc("credit_refund_spend", { p_brand_id: annBrand, p_entry_id: first["entry_id"], p_note: "A flow board did not finish" }));
    const second = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "run-two:board" })) as Record<string, unknown>;

    expect(second["charged"]).toBe(true);
    expect(second["entry_id"]).not.toBe(first["entry_id"]);
  });

  it("charge for each of the pictures a board makes, so the quote and the ledger agree", async () => {
    const version = hash();
    must(await rpc("credit_grant", { p_brand_id: annBrand, p_amount: 40, p_key: `flow-grant-${randomUUID()}`, p_note: "Flow test" }));
    const one = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "units:one", p_units: 1 })) as Record<string, unknown>;
    const four = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "units:four", p_units: 4 })) as Record<string, unknown>;

    expect(Number(four["price"])).toBe(Number(one["price"]) * 4);
    expect((await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "units:none", p_units: 0 })).error).not.toBeNull();
    expect((await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "units:many", p_units: 500 })).error).not.toBeNull();
  });

  it("cut a reason longer than a ledger line holds, rather than failing the refund", async () => {
    const version = hash();
    must(await rpc("credit_grant", { p_brand_id: annBrand, p_amount: 20, p_key: `flow-grant-${randomUUID()}`, p_note: "Flow test" }));
    const spend = must(await rpc("credit_spend_output", { p_brand_id: annBrand, p_user_id: ann.userId, p_kind: "marketing_media", p_version_hash: version, p_output_key: "long:board" })) as Record<string, unknown>;
    const back = must(await rpc("credit_refund_spend", { p_brand_id: annBrand, p_entry_id: spend["entry_id"], p_note: "x".repeat(400) })) as Record<string, unknown>;

    expect(Number(back["refunded"])).toBeGreaterThan(0);
  });
});

describe("the six flow templates of 07", () => {
  it("are seeded in order, each with the asset count the spec gives it", async () => {
    const rows = must(await ann.client.from("flow_templates").select("slug, assets, sections, note").order("sort")) as Record<string, unknown>[];

    expect(rows.map((row) => row["slug"])).toEqual([
      "club-kit-launch-pack",
      "brand-drop-pack",
      "team-store-promo",
      "shopify-product-listing",
      "colourway-set",
      "sponsor-pack",
    ]);
    expect(rows.map((row) => row["assets"])).toEqual([14, 16, 6, 7, 7, 4]);
    expect(rows.every((row) => String(row["note"]).includes("not reviewed by anyone"))).toBe(true);
  });

  it("hold steps whose assets add up to the pack's own count", async () => {
    const steps = must(await ann.client.from("flow_template_steps").select("template_slug, assets, kind")) as Record<string, unknown>[];
    const club = steps.filter((step) => step["template_slug"] === "club-kit-launch-pack");

    expect(club.reduce((total, step) => total + Number(step["assets"]), 0)).toBe(14);
    expect(club.filter((step) => step["kind"] === "design")).toHaveLength(1);
  });

  it("hold the connectors of each pack, and refuse a step under a section its pack does not have", async () => {
    const links = must(await ann.client.from("flow_template_links").select("template_slug, input_index").eq("template_slug", "club-kit-launch-pack")) as Record<string, unknown>[];

    expect(links.length).toBeGreaterThan(10);
    expect(links.some((link) => Number(link["input_index"]) === 2)).toBe(true);
    const refused = await adminClient().from("flow_template_steps").insert({
      template_slug: "sponsor-pack", step_key: "made-up", section: "9 MADE UP", kind: "mockup", name: "Made up",
      generation: "deterministic", format: "png",
    });
    expect(refused.error?.message).toContain("section labels");
  });

  it("are read by any signed-in member and written by none", async () => {
    expect((must(await ben.client.from("flow_templates").select("slug")) as unknown[]).length).toBe(6);
    expect((await ben.client.from("flow_templates").update({ assets: 1 }).eq("slug", "sponsor-pack")).error).not.toBeNull();
  });
});
