import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { canMove, STATUSES } from "@/lib/pattern-service/transitions";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261028010000: pattern service requests (decision 0060). One request per design version; a priced request takes its
 * credits in the same step and a decline gives them back; ops moves a request one step at a time and only a platform admin may;
 * history is append-only; a brand sees only its own requests. Written to run against `pnpm db:start`; the SQL was also run by hand
 * against a bare Postgres 16 with stub tables (see the PR).
 */

let alice: Person;
let bob: Person;
let admin: Person;
let aliceBrand: string;
let bobBrand: string;

type Answer = Record<string, unknown>;

const hash = () => randomUUID().replaceAll("-", "").padEnd(64, "0");
const project = async (brand: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", { p_brand_id: brand, p_user_id: owner.userId, p_name: "Shorts", p_style_number: "", p_season: "", p_garment_type: "shorts", p_spec: { seeded: true }, p_schema_version: 1 }),
  ) as string;

const create = (over: Record<string, unknown>) =>
  adminClient().rpc("pattern_request_create", {
    p_brand_id: aliceBrand, p_user_id: alice.userId, p_design_version: 1, p_article_id: "shorts", p_snapshot: { a: 1 }, p_snapshot_hash: hash(),
    p_price_credits: null, p_turnaround_days: null, p_charge: true, ...over,
  });

const made = async (over: Record<string, unknown> = {}): Promise<string> => {
  const projectId = (over.p_project_id as string | undefined) ?? (await project(aliceBrand, alice));
  return (must(await create({ p_project_id: projectId, ...over })) as Answer).request_id as string;
};

const move = (actor: Person, id: string, to: string, note = "") => adminClient().rpc("pattern_request_move", { p_actor: actor.userId, p_request_id: id, p_to: to, p_note: note });
const balance = async (brand: string) => Number(must(await adminClient().rpc("credit_balance", { p_brand_id: brand })));
const row = async (id: string) => must(await adminClient().from("pattern_requests").select("*").eq("id", id).single()) as Record<string, unknown>;

/** A pattern-source file of the brand, as the server stores one. */
const dxfFile = async (brand: string, owner: Person): Promise<string> => {
  const id = randomUUID();
  must(await adminClient().from("files").insert({ id, brand_id: brand, bucket: "exports", path: `${brand}/pattern-source/${id}.dxf`, kind: "pattern-source", content_type: "application/dxf", bytes: 10, created_by: owner.userId }).select("id"));
  return id;
};

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([person("pattern-alice"), person("pattern-bob"), person("pattern-admin")]);
  [aliceBrand, bobBrand] = await Promise.all([brandOf(alice, "Alice Patterns"), brandOf(bob, "Bob Patterns")]);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("making a request", () => {
  it("makes one request per design version and answers with the same one the second time", async () => {
    const projectId = await project(aliceBrand, alice);
    const first = must(await create({ p_project_id: projectId })) as Answer;
    const second = must(await create({ p_project_id: projectId })) as Answer;
    expect(first).toMatchObject({ ok: true, created: true, charged: false });
    expect(second).toMatchObject({ ok: true, created: false, request_id: first.request_id });
  });

  it("keeps the quote and the snapshot it was given", async () => {
    const id = await made({ p_price_credits: null, p_turnaround_days: 5, p_snapshot: { x: 1 }, p_snapshot_hash: "a".repeat(64) });
    expect(await row(id)).toMatchObject({ status: "requested", quoted_price_credits: null, quoted_turnaround_days: 5, snapshot: { x: 1 }, snapshot_hash: "a".repeat(64) });
  });

  it("refuses a design of another brand, a version that does not exist and a person outside the brand", async () => {
    const theirs = await project(bobBrand, bob);
    expect((await create({ p_project_id: theirs })).error).not.toBeNull();
    const mine = await project(aliceBrand, alice);
    expect((await create({ p_project_id: mine, p_design_version: 2 })).error).not.toBeNull();
    expect((await create({ p_project_id: mine, p_user_id: bob.userId })).error).not.toBeNull();
  });

  it("refuses a snapshot hash that is not a sha256", async () => {
    expect((await create({ p_project_id: await project(aliceBrand, alice), p_snapshot_hash: "short" })).error).not.toBeNull();
  });
});

describe("credits", () => {
  it("takes nothing when no price is set, or when the gate is off", async () => {
    const before = await balance(aliceBrand);
    await made({ p_price_credits: null, p_charge: true });
    await made({ p_price_credits: 3, p_charge: false });
    expect(await balance(aliceBrand)).toBe(before);
  });

  it("takes the price once, in the same step as the request, and refuses when the balance is short", async () => {
    const owner = await person(`pattern-payer-${randomUUID().slice(0, 8)}`);
    const brand = await brandOf(owner, "Payer");
    const projectId = await project(brand, owner);
    const args = { p_brand_id: brand, p_user_id: owner.userId, p_project_id: projectId, p_price_credits: 4 };
    const short = must(await create(args)) as Answer;
    expect(short).toMatchObject({ ok: false, reason: "insufficient", price: 4, balance: 0 });
    expect(must(await adminClient().from("pattern_requests").select("id").eq("project_id", projectId))).toEqual([]);

    must(await adminClient().rpc("credit_grant", { p_brand_id: brand, p_amount: 10, p_key: randomUUID(), p_note: "" }));
    expect(must(await create(args))).toMatchObject({ ok: true, created: true, charged: true, balance: 6 });
    expect(must(await create(args))).toMatchObject({ created: false, charged: false, balance: 6 });
    expect(await balance(brand)).toBe(6);
  });

  it("gives the credits back when the request is declined, once", async () => {
    const owner = await person(`pattern-refund-${randomUUID().slice(0, 8)}`);
    const brand = await brandOf(owner, "Refund");
    must(await adminClient().rpc("credit_grant", { p_brand_id: brand, p_amount: 10, p_key: randomUUID(), p_note: "" }));
    const projectId = await project(brand, owner);
    const id = ((must(await create({ p_brand_id: brand, p_user_id: owner.userId, p_project_id: projectId, p_price_credits: 4 })) as Answer).request_id as string);
    expect(await balance(brand)).toBe(6);
    must(await move(admin, id, "declined", "We cannot draft this"));
    expect(await balance(brand)).toBe(10);
    expect((await move(admin, id, "declined", "again")).error).not.toBeNull();
    expect(await balance(brand)).toBe(10);
  });
});

describe("moving a request", () => {
  it("lets ops move it one step at a time, matching the TypeScript table", async () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (to === "requested") continue;
        const id = await made();
        const path: Record<string, string[]> = { requested: [], accepted: ["accepted"], in_progress: ["accepted", "in_progress"], delivered: ["accepted", "in_progress", "delivered"], declined: ["declined"] };
        const file = await dxfFile(aliceBrand, alice);
        for (const step of path[from]!) {
          if (step === "delivered") must(await adminClient().rpc("pattern_request_attach_files", { p_actor: admin.userId, p_request_id: id, p_file_ids: [file] }));
          must(await move(admin, id, step, "reason"));
        }
        if (to === "delivered" && from === "in_progress") must(await adminClient().rpc("pattern_request_attach_files", { p_actor: admin.userId, p_request_id: id, p_file_ids: [file] }));
        const { error } = await move(admin, id, to, "reason");
        expect(error === null, `${from} to ${to}`).toBe(canMove(from, to));
      }
    }
  }, 60_000);

  it("refuses anyone who is not a platform admin as if the request did not exist", async () => {
    const id = await made();
    const { error } = await move(alice, id, "accepted");
    expect(error?.code).toBe("P0002");
    expect((await row(id)).status).toBe("requested");
  });

  it("needs a reason to decline and files to deliver", async () => {
    const id = await made();
    expect((await move(admin, id, "declined", "  ")).error?.hint).toBe("reason_needed");
    must(await move(admin, id, "accepted"));
    must(await move(admin, id, "in_progress"));
    expect((await move(admin, id, "delivered")).error?.hint).toBe("files_needed");
  });

  it("attaches only this brand's pattern-source files, only while it is being drafted", async () => {
    const id = await made();
    const mine = await dxfFile(aliceBrand, alice);
    const theirs = await dxfFile(bobBrand, bob);
    const attach = (files: string[]) => adminClient().rpc("pattern_request_attach_files", { p_actor: admin.userId, p_request_id: id, p_file_ids: files });
    expect((await attach([mine])).error?.hint).toBe("invalid_transition");
    must(await move(admin, id, "accepted"));
    must(await move(admin, id, "in_progress"));
    expect((await attach([theirs])).error?.hint).toBe("invalid_input");
    expect((await attach([randomUUID()])).error?.hint).toBe("invalid_input");
    must(await attach([mine]));
    must(await attach([mine]));
    expect((await row(id)).file_ids).toEqual([mine]);
  });

  it("records a review only on delivered files", async () => {
    const id = await made();
    const review = () => adminClient().rpc("pattern_request_mark_reviewed", { p_actor: admin.userId, p_request_id: id, p_reviewer_name: "Sana" });
    expect((await review()).error?.hint).toBe("invalid_transition");
    const file = await dxfFile(aliceBrand, alice);
    must(await move(admin, id, "accepted"));
    must(await move(admin, id, "in_progress"));
    must(await adminClient().rpc("pattern_request_attach_files", { p_actor: admin.userId, p_request_id: id, p_file_ids: [file] }));
    must(await move(admin, id, "delivered"));
    must(await review());
    expect(await row(id)).toMatchObject({ reviewed_by: "Sana" });
  });
});

describe("history and access", () => {
  it("writes a history line for every step and never lets one change", async () => {
    const id = await made();
    must(await move(admin, id, "accepted", "On it"));
    const events = must(await adminClient().from("pattern_request_events").select("kind, from_status, to_status, note").eq("request_id", id).order("seq")) as Answer[];
    expect(events).toEqual([
      { kind: "requested", from_status: null, to_status: "requested", note: "" },
      { kind: "accepted", from_status: "requested", to_status: "accepted", note: "On it" },
    ]);
    const update = await adminClient().from("pattern_request_events").update({ note: "x" }).eq("request_id", id);
    const remove = await adminClient().from("pattern_request_events").delete().eq("request_id", id);
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
  });

  it("answers permission denied to a direct write, even from the server's key", async () => {
    const id = await made();
    const { error } = await adminClient().from("pattern_requests").update({ status: "delivered" }).eq("id", id);
    expect(error?.message).toMatch(/permission denied/i);
  });

  it("shows a member their brand's requests, another brand nothing, and a platform admin everything", async () => {
    const id = await made();
    expect(must(await alice.client.from("pattern_requests").select("id").eq("id", id))).toHaveLength(1);
    expect(must(await bob.client.from("pattern_requests").select("id").eq("id", id))).toHaveLength(0);
    expect(must(await bob.client.from("pattern_request_events").select("id").eq("request_id", id))).toHaveLength(0);
    expect(must(await admin.client.from("pattern_requests").select("id").eq("id", id))).toHaveLength(1);
  });

  it("lets no browser session run the functions", async () => {
    const id = await made();
    const { error } = await alice.client.rpc("pattern_request_move", { p_actor: alice.userId, p_request_id: id, p_to: "accepted", p_note: "" });
    expect(error).not.toBeNull();
  });
});
