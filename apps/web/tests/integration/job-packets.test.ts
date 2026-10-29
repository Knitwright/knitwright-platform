import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { nextStep, ORDER_MOVE, FACTORY_STEPS } from "@/lib/job-packet/steps";
import { packetTokenHash } from "@/lib/job-packet/token";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Factory job packets. Decision 0072, spec F-O2. A token opens one open packet and nothing else; the three
 * buttons go one at a time and move the batch's orders exactly as the ops console's own step does; what a
 * factory recorded can never be changed; no browser role may run any of it. Needs `pnpm db:start`.
 */

const token = (): string => randomBytes(32).toString("base64url");

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

/** Runs SQL as the owner of the tables, which no API role is: nothing else may age a link. */
const asOwner = (sql: string): string =>
  execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });

const dockerReachable = (() => {
  try {
    asOwner("select 1");
    return true;
  } catch {
    return false;
  }
})();

/** Moves a packet's expiry into the past, the way only the table's owner can. */
const age = (packetId: string): void => {
  asOwner(`update public.job_packets set created_at = now() - interval '40 days', expires_at = now() - interval '1 second' where id = '${packetId}'`);
};

let alice: Person;
let ops: Person;
let aliceBrand: string;

type Issued = { id: string; expires_at: string };

const makeRelease = async (owner: Person, brandId: string, label: string): Promise<string> => {
  const project = must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId, p_user_id: owner.userId, p_name: "Jersey", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1,
    }),
  ) as string;
  const created = must(
    await adminClient().rpc("create_release", {
      p_project_id: project, p_brand_id: brandId, p_user_id: owner.userId, p_label: label,
      p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] },
      p_file_specs: [], p_order_id: null,
    }),
  ) as { id: string }[];
  return created[0]!.id;
};

/** A batch of one order of Alice's brand, cut as ops would on the day. Returns the batch and the order. */
const batchOf = async (): Promise<{ batchId: string; orderId: string }> => {
  const releaseId = await makeRelease(alice, aliceBrand, "Round 1 jerseys");
  const submitted = must(
    await adminClient().rpc("submit_order_for_production", {
      p_release_id: releaseId, p_external_ref: `packet-${randomUUID()}`, p_factory_profile_id: "f1",
      p_fabric_key: "mesh", p_article_id: "crew-tee", p_sizes: { M: 2, L: 1 },
    }),
  ) as { order_id: string }[];
  const orderId = submitted[0]!.order_id;
  const order = must(await adminClient().from("ops_orders").select("cutoff_at").eq("id", orderId).single()) as { cutoff_at: string };
  must(await adminClient().rpc("ops_cut_batches", { p_actor: ops.userId, p_now: new Date(Date.parse(order.cutoff_at) + 1000).toISOString() }));
  const placed = must(await adminClient().from("ops_orders").select("batch_id, status").eq("id", orderId).single()) as { batch_id: string; status: string };
  expect(placed.status).toBe("batched");
  return { batchId: placed.batch_id, orderId };
};

const create = async (batchId: string, secret = token(), days = 28, actor = ops.userId) =>
  adminClient().rpc("create_job_packet", { p_actor: actor, p_batch_id: batchId, p_token: secret, p_days: days });

const created = async (batchId: string, secret = token(), days = 28): Promise<Issued & { token: string }> => {
  const rows = must(await create(batchId, secret, days)) as Issued[];
  return { ...rows[0]!, token: secret };
};

/** A fresh batch with an open packet on it. */
const packet = async () => {
  const { batchId, orderId } = await batchOf();
  return { batchId, orderId, ...(await created(batchId)) };
};

const record = (secret: string, patch: Record<string, unknown> = {}) =>
  adminClient().rpc("job_packet_record", { p_token: secret, p_kind: "received", p_note: "", p_photo_key: null, ...patch });

const open = async (secret: string) => must(await adminClient().rpc("open_job_packet", { p_token: secret })) as Record<string, unknown>[];
const packetRow = async (id: string) => must(await adminClient().from("job_packets").select("*").eq("id", id).single()) as Record<string, unknown>;
const statusOf = async (orderId: string) => (must(await adminClient().from("ops_orders").select("status").eq("id", orderId).single()) as { status: string }).status;
const eventsOf = async (batchId: string) => must(await adminClient().from("factory_events").select("*").eq("batch_id", batchId).order("at").order("id")) as Record<string, unknown>[];
const orderKinds = async (orderId: string) =>
  (must(await adminClient().from("ops_order_events").select("kind, actor, note").eq("order_id", orderId).order("at").order("id")) as { kind: string; actor: string | null; note: string }[]);

beforeAll(async () => {
  [alice, ops] = await Promise.all([person("packet-alice"), person("packet-ops")]);
  aliceBrand = await brandOf(alice, "Alice Hockey Club");
  must(await adminClient().from("platform_admins").insert({ user_id: ops.userId }).select("user_id"));
});

describe("create_job_packet", () => {
  it("keeps only the SHA-256 of the token and expires after the days ops chose", async () => {
    const { batchId } = await batchOf();
    const made = await created(batchId, token(), 7);

    const row = await packetRow(made.id);
    expect(row).toMatchObject({ batch_id: batchId, created_by: ops.userId, revoked_at: null, sent_count: 1 });
    expect(JSON.stringify(row)).not.toContain(made.token);
    expect(String(row.token_hash)).toBe(`\\x${packetTokenHash(made.token).toString("hex")}`);
    expect(Math.round((Date.parse(String(row.expires_at)) - Date.parse(String(row.created_at))) / 86_400_000)).toBe(7);
  });

  it("gives a batch one link at a time: a second is refused until the first is revoked", async () => {
    const { batchId } = await batchOf();
    const first = await created(batchId);

    expect((await create(batchId)).error?.hint).toBe("packet_exists");

    must(await adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: batchId, p_packet_id: first.id }));
    const second = await created(batchId);
    expect(second.id).not.toBe(first.id);
  });

  it("refuses anyone who is not a platform admin, a batch that does not exist, a bad token and bad days", async () => {
    const { batchId } = await batchOf();

    expect((await create(batchId, token(), 28, alice.userId)).error?.message).toBe("Not found.");
    expect((await create(batchId, token(), 28, randomUUID())).error?.message).toBe("Not found.");
    expect((await create(randomUUID())).error?.message).toBe("That batch does not exist.");
    expect((await create(batchId, "short")).error).not.toBeNull();
    expect((await create(batchId, `${token()}/`)).error).not.toBeNull();
    expect((await create(batchId, token(), 0)).error).not.toBeNull();
    expect((await create(batchId, token(), 91)).error).not.toBeNull();
    expect(must(await adminClient().from("job_packets").select("id").eq("batch_id", batchId))).toHaveLength(0);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const { batchId } = await batchOf();
    const args = { p_actor: ops.userId, p_batch_id: batchId, p_token: token(), p_days: 28 };

    expect((await ops.client.rpc("create_job_packet", args)).error).not.toBeNull();
    expect((await anonClient().rpc("create_job_packet", args)).error).not.toBeNull();
  });
});

describe("open_job_packet", () => {
  it("gives the packet and its batch for a token that still works", async () => {
    const made = await packet();

    expect(await open(made.token)).toEqual([{ packet_id: made.id, batch_id: made.batchId, expires_at: made.expires_at }]);
  });

  it("gives nothing for a token that is wrong or revoked, by the same path", async () => {
    const made = await packet();
    expect(await open(token())).toEqual([]);
    expect(await open("short")).toEqual([]);
    expect(await open("")).toEqual([]);

    must(await adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id }));
    expect(await open(made.token)).toEqual([]);
  });

  // No role the API offers may change a packet's dates, so the table's owner ages one through psql in the
  // database container, as share-links.test.ts does. Skipped without Docker.
  it.skipIf(!dockerReachable)("gives nothing once the link has expired, and nothing can be recorded through it", async () => {
    const made = await packet();
    expect(await open(made.token)).toHaveLength(1);

    age(made.id);

    expect(await open(made.token)).toEqual([]);
    expect((await record(made.token)).error?.message).toBe("That link does not exist.");
    expect(await eventsOf(made.batchId)).toHaveLength(0);
    expect(await statusOf(made.orderId)).toBe("batched");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const made = await packet();

    expect((await ops.client.rpc("open_job_packet", { p_token: made.token })).error).not.toBeNull();
    expect((await anonClient().rpc("open_job_packet", { p_token: made.token })).error).not.toBeNull();
  });
});

describe("resend_job_packet", () => {
  it("gives a new token and expiry, counts the send, and stops the old address opening anything", async () => {
    const made = await packet();
    const next = token();

    const rows = must(await adminClient().rpc("resend_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id, p_token: next, p_days: 14 })) as Issued[];

    expect(rows[0]!.id).toBe(made.id);
    expect(await open(made.token)).toEqual([]);
    expect(await open(next)).toHaveLength(1);
    const row = await packetRow(made.id);
    expect(row.sent_count).toBe(2);
    expect(Math.round((Date.parse(String(row.expires_at)) - Date.parse(String(row.last_sent_at))) / 86_400_000)).toBe(14);
  });

  it("refuses a link of another batch, a revoked link and anyone who is not a platform admin", async () => {
    const made = await packet();
    const elsewhere = await packet();
    const send = (patch: Record<string, unknown>) =>
      adminClient().rpc("resend_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id, p_token: token(), p_days: 28, ...patch });

    expect((await send({ p_packet_id: elsewhere.id })).error?.message).toBe("That factory link does not exist.");
    expect((await send({ p_batch_id: elsewhere.batchId })).error?.message).toBe("That factory link does not exist.");
    expect((await send({ p_actor: alice.userId })).error?.message).toBe("Not found.");

    must(await adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id }));
    expect((await send({})).error?.hint).toBe("packet_revoked");
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const made = await packet();
    const args = { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id, p_token: token(), p_days: 28 };

    expect((await ops.client.rpc("resend_job_packet", args)).error).not.toBeNull();
    expect((await anonClient().rpc("resend_job_packet", args)).error).not.toBeNull();
  });
});

describe("revoke_job_packet", () => {
  it("stops the link, and revoking it again changes nothing", async () => {
    const made = await packet();
    const revoke = () => adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id });

    must(await revoke());
    const first = (await packetRow(made.id)).revoked_at;
    must(await revoke());

    expect((await packetRow(made.id)).revoked_at).toBe(first);
    expect(await open(made.token)).toEqual([]);
  });

  it("refuses a link of another batch, a link that does not exist, and anyone who is not a platform admin", async () => {
    const made = await packet();
    const elsewhere = await packet();
    const revoke = (patch: Record<string, unknown>) =>
      adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id, ...patch });

    expect((await revoke({ p_packet_id: elsewhere.id })).error?.message).toBe("That factory link does not exist.");
    expect((await revoke({ p_packet_id: randomUUID() })).error?.message).toBe("That factory link does not exist.");
    expect((await revoke({ p_actor: alice.userId })).error?.message).toBe("Not found.");
    expect((await packetRow(made.id)).revoked_at).toBeNull();
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const made = await packet();
    const args = { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id };

    expect((await ops.client.rpc("revoke_job_packet", args)).error).not.toBeNull();
    expect((await anonClient().rpc("revoke_job_packet", args)).error).not.toBeNull();
  });
});

describe("job_packet_record", () => {
  it("walks the batch's orders through the three steps, writing each one's history with no actor", async () => {
    const made = await packet();

    for (const step of FACTORY_STEPS) {
      const rows = must(await record(made.token, { p_kind: step })) as { event_id: string; at: string; orders_moved: number }[];
      expect(rows[0]!.orders_moved, step).toBe(1);
      expect(await statusOf(made.orderId), step).toBe(ORDER_MOVE[step].to);
    }

    const history = await orderKinds(made.orderId);
    expect(history.map((e) => e.kind)).toEqual(["submitted", "batched", "received", "in_production", "ready"]);
    for (const event of history.slice(2)) {
      expect(event.actor).toBeNull();
      expect(event.note).toBe("Marked by the factory through its job packet.");
    }
    expect((await eventsOf(made.batchId)).map((e) => e.kind)).toEqual([...FACTORY_STEPS]);
  });

  it("takes each step once, in order: no skipping, no repeating, no going back", async () => {
    const made = await packet();

    expect((await record(made.token, { p_kind: "in_production" })).error?.hint).toBe("illegal_step");
    expect((await record(made.token, { p_kind: "ready_for_qc" })).error?.hint).toBe("illegal_step");
    must(await record(made.token, { p_kind: "received" }));
    expect((await record(made.token, { p_kind: "received" })).error?.hint).toBe("illegal_step");
    must(await record(made.token, { p_kind: "in_production" })) ;
    expect((await record(made.token, { p_kind: "received" })).error?.hint).toBe("illegal_step");
    expect(nextStep("in_production")).toBe("ready_for_qc");
    expect(await statusOf(made.orderId)).toBe("in_production");
  });

  it("moves only the orders standing at the step before, and leaves the rest as they are", async () => {
    const made = await packet();
    must(await adminClient().rpc("ops_set_order_status", { p_actor: ops.userId, p_order_id: made.orderId, p_to: "received" }));

    const rows = must(await record(made.token, { p_kind: "received" })) as { orders_moved: number }[];

    expect(rows[0]!.orders_moved).toBe(0);
    expect(await statusOf(made.orderId)).toBe("received");
    expect((await eventsOf(made.batchId))[0]).toMatchObject({ kind: "received", orders_moved: 0 });
  });

  it("keeps a note, trimmed, and refuses an empty or over-long one", async () => {
    const made = await packet();

    must(await record(made.token, { p_kind: "note", p_note: "  Yarn arrived.  " }));
    expect((await eventsOf(made.batchId))[0]).toMatchObject({ kind: "note", note: "Yarn arrived.", orders_moved: 0 });

    expect((await record(made.token, { p_kind: "note", p_note: "   " })).error?.hint).toBe("invalid_note");
    expect((await record(made.token, { p_kind: "note", p_note: "x".repeat(1001) })).error?.hint).toBe("invalid_note");
    expect(await eventsOf(made.batchId)).toHaveLength(1);
  });

  it("keeps a photo only under its own packet's folder, and never without one", async () => {
    const made = await packet();
    const key = (packetId: string) => `job-packets/${packetId}/${randomUUID()}.jpg`;

    must(await record(made.token, { p_kind: "photo", p_note: "Line 3", p_photo_key: key(made.id) }));
    expect((await eventsOf(made.batchId))[0]).toMatchObject({ kind: "photo", note: "Line 3" });

    const elsewhere = await packet();
    expect((await record(made.token, { p_kind: "photo", p_photo_key: key(elsewhere.id) })).error).not.toBeNull();
    expect((await record(made.token, { p_kind: "photo", p_photo_key: `job-packets/${made.id}/../../secret.jpg` })).error).not.toBeNull();
    expect((await record(made.token, { p_kind: "photo", p_photo_key: `job-packets/${made.id}/x.svg` })).error).not.toBeNull();
    expect((await record(made.token, { p_kind: "photo", p_photo_key: null })).error).not.toBeNull();
    expect((await record(made.token, { p_kind: "note", p_note: "n", p_photo_key: key(made.id) })).error).not.toBeNull();
    expect(await eventsOf(made.batchId)).toHaveLength(1);
  });

  it("gives one answer for a token that is wrong, revoked or expired, and records nothing", async () => {
    const made = await packet();
    expect((await record(token())).error?.message).toBe("That link does not exist.");
    expect((await record("short")).error?.message).toBe("That link does not exist.");

    must(await adminClient().rpc("revoke_job_packet", { p_actor: ops.userId, p_batch_id: made.batchId, p_packet_id: made.id }));
    expect((await record(made.token)).error?.message).toBe("That link does not exist.");
    expect(await eventsOf(made.batchId)).toHaveLength(0);
    expect(await statusOf(made.orderId)).toBe("batched");
  });

  it("refuses a kind that is not one a factory can record", async () => {
    const made = await packet();

    for (const kind of ["shipped", "ready", "", "delete"]) expect((await record(made.token, { p_kind: kind })).error, kind).not.toBeNull();
    expect((await record(made.token, { p_kind: null })).error).not.toBeNull();
    expect(await eventsOf(made.batchId)).toHaveLength(0);
  });

  it("cannot be run by a browser, signed in or not", async () => {
    const made = await packet();
    const args = { p_token: made.token, p_kind: "received", p_note: "", p_photo_key: null };

    expect((await ops.client.rpc("job_packet_record", args)).error).not.toBeNull();
    expect((await anonClient().rpc("job_packet_record", args)).error).not.toBeNull();
    expect(await eventsOf(made.batchId)).toHaveLength(0);
  });
});

describe("the grants", () => {
  it("leave the server's own key with nothing but SELECT on both tables", async () => {
    const made = await packet();
    const row = { batch_id: made.batchId, token_hash: `\\x${"11".repeat(32)}`, expires_at: "2099-01-01T00:00:00Z" };

    expect((await adminClient().from("job_packets").insert(row).select("id")).error).not.toBeNull();
    expect((await adminClient().from("job_packets").update({ sent_count: 9 }).eq("id", made.id).select("id")).error).not.toBeNull();
    expect((await adminClient().from("job_packets").delete().eq("id", made.id).select("id")).error).not.toBeNull();
    expect((await adminClient().from("factory_events").insert({ packet_id: made.id, batch_id: made.batchId, kind: "note", note: "Direct." }).select("id")).error).not.toBeNull();
    expect(await packetRow(made.id)).toMatchObject({ sent_count: 1 });
  });
});

describe("factory_events is append-only", () => {
  it("cannot be changed or removed by the server's own key", async () => {
    const made = await packet();
    must(await record(made.token, { p_kind: "received" }));
    const row = (await eventsOf(made.batchId))[0]!;

    expect((await adminClient().from("factory_events").update({ note: "Changed by ops." }).eq("id", row.id as string).select("id")).error).not.toBeNull();
    expect((await adminClient().from("factory_events").delete().eq("id", row.id as string).select("id")).error).not.toBeNull();
    expect((await eventsOf(made.batchId))[0]!.note).toBe("");
  });

  // The grants stop every role the API offers. A trigger stops the owner of the table too, which only psql
  // inside the database container can be, as append-only-owner.test.ts does. Skipped without Docker.
  it.skipIf(!dockerReachable)("cannot be changed or removed by the owner of the table either", async () => {
    const made = await packet();
    must(await record(made.token, { p_kind: "received", p_note: "Started." }));
    const id = (await eventsOf(made.batchId))[0]!.id as string;

    for (const sql of [
      `begin; update public.factory_events set note = 'Edited.' where id = '${id}'; rollback;`,
      `begin; delete from public.factory_events where id = '${id}'; rollback;`,
      "begin; truncate public.factory_events; rollback;",
    ]) {
      let refused = "";
      try {
        asOwner(sql);
      } catch (error) {
        refused = (error as { stderr?: string; message: string }).stderr ?? (error as Error).message;
      }
      expect(refused, sql).toMatch(/can never be changed or removed/);
    }
    expect((await eventsOf(made.batchId))[0]!.note).toBe("Started.");
  });
});

describe("what a member and a visitor may see", () => {
  it("shows a platform admin both tables and a member neither", async () => {
    const made = await packet();
    must(await record(made.token, { p_kind: "received", p_note: "Started." }));

    expect(must(await ops.client.from("job_packets").select("id").eq("id", made.id))).toHaveLength(1);
    expect(must(await ops.client.from("factory_events").select("id").eq("batch_id", made.batchId))).toHaveLength(1);

    const asMember = await alice.client.from("job_packets").select("id").eq("id", made.id);
    const theirEvents = await alice.client.from("factory_events").select("id").eq("batch_id", made.batchId);
    expect(asMember.error ?? asMember.data).toEqual([]);
    expect(theirEvents.error ?? theirEvents.data).toEqual([]);
    const asVisitor = await anonClient().from("job_packets").select("id");
    expect(asVisitor.error ?? asVisitor.data).toEqual([]);
  });

  it("lets no browser role write either table, whatever it sends", async () => {
    const made = await packet();
    must(await record(made.token, { p_kind: "received" }));
    const event = (await eventsOf(made.batchId))[0]!.id as string;
    const row = { batch_id: made.batchId, token_hash: `\\x${"00".repeat(32)}`, expires_at: "2099-01-01T00:00:00Z" };

    for (const client of [ops.client, alice.client, anonClient()]) {
      expect((await client.from("job_packets").insert(row).select("id")).error).not.toBeNull();
      expect((await client.from("job_packets").update({ expires_at: "2099-01-01T00:00:00Z" }).eq("id", made.id).select("id")).error).not.toBeNull();
      expect((await client.from("job_packets").delete().eq("id", made.id).select("id")).error).not.toBeNull();
      expect((await client.from("factory_events").insert({ packet_id: made.id, batch_id: made.batchId, kind: "received" }).select("id")).error).not.toBeNull();
      expect((await client.from("factory_events").update({ note: "Changed." }).eq("id", event).select("id")).error).not.toBeNull();
      expect((await client.from("factory_events").delete().eq("id", event).select("id")).error).not.toBeNull();
    }
    expect(await packetRow(made.id)).toMatchObject({ expires_at: made.expires_at, revoked_at: null });
    expect((await eventsOf(made.batchId))[0]!.note).toBe("");
  });
});
