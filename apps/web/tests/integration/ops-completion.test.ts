import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { AQL_PLAN_COLUMNS, toAqlPlan } from "@/lib/compliance/rows";
import { samplingFor } from "@/lib/ops/aql/from-plan";
import { EMPTY_AQL_TABLE, planFor, type AqlTable } from "@/lib/ops/aql/plan";
import { readable, toAcceptance, toSamplePlan, ACCEPTANCE_COLUMNS, SAMPLE_PLAN_COLUMNS } from "@/lib/ops/aql/rows";
import { evaluateInspection, type ChecklistItem } from "@/lib/ops/qc/checklist";
import { colourReadingsPass } from "@/lib/ops/qc/colour";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Ops completion (plan v5 O1, decision 0100): the scheduled cut, the AQL table, typed Delta-E readings,
 * third-party inspection, couriers, the commercial invoice and customer status emails.
 *
 * Written in the idiom of ops-qc.test.ts. **Every order here gets its own fabric key**: `ops_cut_batches`
 * groups by factory, fabric, article and cut-off and reuses a batch it has already cut, so a shared fabric
 * would hand this file another spec's batch (plan v5, lesson 11).
 */

let alice: Person;
let admin: Person;
let aliceBrand: string;
let releaseId: string;

const ref = () => `o1-${randomUUID().slice(0, 12)}`;
const rpc = (name: string, args: Record<string, unknown> = {}) => adminClient().rpc(name, { p_actor: admin.userId, ...args });
const KEYS = ["measurements", "colour", "artwork", "names_numbers"] as const;
const checklist = (): ChecklistItem[] => KEYS.map((key) => ({ key, result: "pass", note: "" }));
const GOOD = [{ point: "Chest", specMm: 520, measuredMm: 522, toleranceMm: 5 }];
const REMAKE = { p_remake_sizes: { M: 1 }, p_remake_owner: "Sam", p_remake_due_on: "2099-01-01" };

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("o1-alice"), person("o1-admin")]);
  aliceBrand = await brandOf(alice, "Ops Completion FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  const project = must(
    await adminClient().rpc("create_project", {
      p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "Jersey", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1,
    }),
  ) as string;
  const created = must(
    await adminClient().rpc("create_release", {
      p_project_id: project, p_brand_id: aliceBrand, p_user_id: alice.userId, p_label: "O1 round",
      p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] },
      p_file_specs: [], p_order_id: null,
    }),
  ) as { id: string }[];
  releaseId = created[0]!.id;
});

/** An order of 5 pieces on its own fabric, taken to whichever status is asked for. */
async function orderAt(status: "submitted" | "ready"): Promise<{ id: string; cutoffAt: string }> {
  const rows = must(
    await adminClient().rpc("submit_order_for_production", {
      p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: `o1-factory-${randomUUID().slice(0, 8)}`,
      p_fabric_key: `o1-fabric-${randomUUID().slice(0, 8)}`, p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 },
      p_value_minor: 29_000, p_currency: "GBP",
    }),
  ) as { order_id: string; cutoff_at: string }[];
  const id = rows[0]!.order_id;
  if (status === "submitted") return { id, cutoffAt: rows[0]!.cutoff_at };
  must(await rpc("ops_cut_batches", { p_now: new Date(Date.parse(rows[0]!.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) must(await rpc("ops_set_order_status", { p_order_id: id, p_to: to }));
  return { id, cutoffAt: rows[0]!.cutoff_at };
}

/**
 * True when a change to one of these tables was refused. The service role holds SELECT alone on every one of
 * them, so the missing privilege refuses an update before the append-only trigger is even reached; the trigger
 * is the second line of defence, for any role that is ever granted UPDATE by mistake. Either refusal counts,
 * and a change that went through counts as neither. PostgREST puts the missing privilege in `hint` and
 * "permission denied for table …" in `message`, so both are read.
 */
const refusedAsReadOnly = (error: { hint?: string | null; message?: string } | null, table: string): boolean => {
  if (error === null) return false;
  const said = `${error.hint ?? ""} ${error.message ?? ""}`;
  return error.hint === "append_only" || said.includes(`UPDATE ON public.${table}`) || /permission denied/i.test(said);
};

const scheduled = (now: Date) => adminClient().rpc("ops_cut_scheduled", { p_now: now.toISOString() });
/** A moment that many weeks back. Its cut-off is in the past, so a cut as of then cuts nothing. */
const weeksAgo = (weeks: number): Date => new Date(Date.now() - weeks * 7 * 86_400_000);
const statusOf = async (id: string): Promise<string> =>
  (must(await adminClient().from("ops_orders").select("status").eq("id", id).single()) as { status: string }).status;

describe("the scheduled cut", () => {
  it("cuts once for a cut-off and does nothing the second time, so a cron that fires twice is harmless", async () => {
    // A moment a year ago: its cut-off is one no other spec uses, and no order's cut-off is in the past,
    // so this cuts nothing and still proves the idempotency the cron depends on.
    // A different week on every run, so a repeat of this suite still meets a cut-off nobody has cut.
    const past = weeksAgo(52 + Math.floor(Math.random() * 200));
    const first = must(await scheduled(past)) as { cut_for: string; orders_batched: number; ran: boolean }[];
    expect(first[0]).toMatchObject({ orders_batched: 0, ran: true });
    const again = must(await scheduled(new Date(past.getTime() + 3600_000))) as { cut_for: string; ran: boolean }[];
    expect(again[0]).toMatchObject({ cut_for: first[0]!.cut_for, ran: false });
    const runs = must(await adminClient().from("ops_cut_runs").select("id").eq("cut_for", first[0]!.cut_for)) as unknown[];
    expect(runs).toHaveLength(1);
  });

  it("cuts the orders whose cut-off has come, or says the cut-off was already cut", async () => {
    const order = await orderAt("submitted");
    const out = must(await scheduled(new Date(Date.parse(order.cutoffAt) + 1000))) as { ran: boolean; orders_batched: number }[];
    if (out[0]!.ran) {
      expect(out[0]!.orders_batched).toBeGreaterThanOrEqual(1);
      expect(await statusOf(order.id)).toBe("batched");
    } else {
      // Another spec cut this week's cut-off first; the button still cuts it, which is the point of the row.
      must(await rpc("ops_cut_batches", { p_now: new Date(Date.parse(order.cutoffAt) + 1000).toISOString() }));
      expect(await statusOf(order.id)).toBe("batched");
    }
  });

  it("can never be changed: the service role holds no UPDATE at all, and a trigger stands behind that", async () => {
    const past = weeksAgo(300 + Math.floor(Math.random() * 200));
    must(await scheduled(past));
    const change = await adminClient().from("ops_cut_runs").update({ orders_batched: 99 }).gt("orders_batched", -1);
    expect(refusedAsReadOnly(change.error, "ops_cut_runs")).toBe(true);
  });

  it("is not something a browser may run", async () => {
    const asMember = alice.client;
    expect((await asMember.rpc("ops_cut_scheduled", {})).error).not.toBeNull();
  });
});

describe("the AQL table", () => {
  it("is seeded for level II, with every row saying no source is cited", async () => {
    const plans = must(await adminClient().from("ops_aql_sample_plans").select(SAMPLE_PLAN_COLUMNS).order("lot_min")) as unknown[];
    expect(plans.length).toBeGreaterThanOrEqual(15);
    for (const row of plans.map(toSamplePlan)) {
      expect([row.source, row.sourced]).toEqual([null, false]);
      expect(row.label.toLowerCase()).toContain("not checked against the standard");
    }
  });

  it("gives the TypeScript reading the same plan the rows hold", async () => {
    const [plans, acceptance] = await Promise.all([
      adminClient().from("ops_aql_sample_plans").select(SAMPLE_PLAN_COLUMNS).order("lot_min"),
      adminClient().from("ops_aql_acceptance").select(ACCEPTANCE_COLUMNS).order("aql").order("code_letter"),
    ]);
    const table: AqlTable = { plans: readable(must(plans) as unknown[], toSamplePlan), acceptance: readable(must(acceptance) as unknown[], toAcceptance) };
    const plan = planFor(table, 400);
    expect(plan.status).toBe("on-file");
    if (plan.status !== "on-file") return;
    expect(plan.codeLetter).toBe("H");
    expect(plan.sourced).toBe(false);
    // Every AQL column the spec names (0 critical, 2.5 major, 4.0 minor) resolves to accept and reject numbers.
    expect(plan.levels.map((l) => l.aql)).toEqual([0, 2.5, 4]);
    for (const level of plan.levels) expect(level.rejectAt).toBe(level.acceptAt + 1);
  });

  it("takes the levels from Z8's own plan row and finds them in this table", async () => {
    const [plans, acceptance, aqlPlans] = await Promise.all([
      adminClient().from("ops_aql_sample_plans").select(SAMPLE_PLAN_COLUMNS).order("lot_min"),
      adminClient().from("ops_aql_acceptance").select(ACCEPTANCE_COLUMNS).order("aql").order("code_letter"),
      adminClient().from("aql_plans").select(AQL_PLAN_COLUMNS),
    ]);
    const table: AqlTable = { plans: readable(must(plans) as unknown[], toSamplePlan), acceptance: readable(must(acceptance) as unknown[], toAcceptance) };
    const rows = (must(aqlPlans) as Record<string, unknown>[]).map(toAqlPlan);
    // The seeded run plan is the one for every factory, so a factory with no plan of its own still gets it.
    const answer = samplingFor(rows, table, { factoryId: null, lotSize: 400 });
    expect(answer.status).toBe("sampled");
    if (answer.status !== "sampled" || answer.sampling.status !== "on-file") return;
    expect(answer.plan.inspectionLevel).toBe("II");
    expect(answer.sampling.codeLetter).toBe("H");
    // Only the levels the plan names, which are the spec's three.
    expect(answer.sampling.levels.map((l) => l.aql)).toEqual([0, 2.5, 4]);
  });

  it("asks for no sample size for a Class A sample, because owner decision 19 inspects every piece", async () => {
    const aqlPlans = must(await adminClient().from("aql_plans").select(AQL_PLAN_COLUMNS)) as Record<string, unknown>[];
    const answer = samplingFor(aqlPlans.map(toAqlPlan), EMPTY_AQL_TABLE, { factoryId: null, lotSize: 3, scope: "class_a_sample" });
    expect(answer.status).toBe("every-piece");
  });

  it("every arrow in the table points at a letter that holds numbers", async () => {
    const rows = must(await adminClient().from("ops_aql_acceptance").select(ACCEPTANCE_COLUMNS)) as unknown[];
    const acceptance = readable(rows, toAcceptance);
    for (const arrow of acceptance.filter((a) => a.useCodeLetter !== null)) {
      const target = acceptance.find((a) => a.codeLetter === arrow.useCodeLetter && a.aql === arrow.aql);
      expect(target?.acceptAt, `${arrow.codeLetter} at AQL ${arrow.aql}`).not.toBeNull();
    }
  });

  it("is reachable by no browser role at all", async () => {
    expect((await alice.client.from("ops_aql_sample_plans").select("code_letter")).error).not.toBeNull();
    expect((await admin.client.from("ops_aql_acceptance").select("code_letter")).error).not.toBeNull();
  });
});

const inspect = (orderId: string, over: Record<string, unknown> = {}) =>
  rpc("ops_record_inspection", { p_order_id: orderId, p_checklist: checklist(), p_measurements: GOOD, p_sample_size: 5, p_defect_count: 0, ...over });

describe("typed Delta-E readings", () => {
  it("records a reading with what it was judged against, and passes when it is inside", async () => {
    const order = await orderAt("ready");
    const readings = [{ colourName: "Kit navy", deltaE: 1.2, limitDeltaE: 1.5, ruleId: "R-SUB-005" }];
    const out = must(await inspect(order.id, { p_colour_readings: readings, p_aql_code_letter: "D" })) as { inspection_id: string; result: string }[];
    expect(out[0]!.result).toBe("pass");
    const kept = must(
      await adminClient().from("ops_qc_colour_readings").select("colour_name, delta_e, limit_delta_e, rule_id").eq("inspection_id", out[0]!.inspection_id).single(),
    ) as Record<string, unknown>;
    expect(kept).toMatchObject({ colour_name: "Kit navy", rule_id: "R-SUB-005" });
    expect([Number(kept.delta_e), Number(kept.limit_delta_e)]).toEqual([1.2, 1.5]);
    const letter = must(await adminClient().from("ops_qc_inspections").select("aql_code_letter").eq("id", out[0]!.inspection_id).single()) as { aql_code_letter: string };
    expect(letter.aql_code_letter).toBe("D");
  });

  it("fails the inspection when a reading is over the tolerance on file, as the TypeScript sum does", async () => {
    const order = await orderAt("ready");
    const readings = [{ colourName: "Kit navy", deltaE: 2.1, limitDeltaE: 1.5 }];
    const expected = evaluateInspection({ checklist: checklist(), measurements: GOOD, defectCount: 0, colourReadingsPass: colourReadingsPass([{ colourName: "Kit navy", deltaE: 2.1, limitDeltaE: 1.5, method: null, instrument: null, whitePoint: null, observer: null, ruleId: "R-SUB-005" }]) });
    expect(expected.result).toBe("fail");
    expect((await inspect(order.id, { p_colour_readings: readings })).error?.hint).toBe("remake_needed");
    const out = must(await inspect(order.id, { p_colour_readings: readings, ...REMAKE })) as { result: string }[];
    expect(out[0]!.result).toBe("fail");
  });

  it("never fails an inspection on a reading with no tolerance on file", async () => {
    const order = await orderAt("ready");
    const out = must(await inspect(order.id, { p_colour_readings: [{ colourName: "Kit navy", deltaE: 99, limitDeltaE: null }] })) as { result: string }[];
    expect(out[0]!.result).toBe("pass");
  });

  it("refuses a reading it cannot read, and a code letter that is not on file", async () => {
    const order = await orderAt("ready");
    expect((await inspect(order.id, { p_colour_readings: [{ colourName: "", deltaE: 1 }] })).error?.hint).toBe("invalid_colour_readings");
    expect((await inspect(order.id, { p_colour_readings: [{ colourName: "Navy", deltaE: "lots" }] })).error?.hint).toBe("invalid_colour_readings");
    expect((await inspect(order.id, { p_aql_code_letter: "Z" })).error?.hint).toBe("invalid_aql_letter");
  });

  it("is append-only, and the service role may only read it", async () => {
    const order = await orderAt("ready");
    must(await inspect(order.id, { p_colour_readings: [{ colourName: "Kit navy", deltaE: 1 }] }));
    const change = await adminClient().from("ops_qc_colour_readings").update({ colour_name: "Changed" }).eq("order_id", order.id);
    expect(refusedAsReadOnly(change.error, "ops_qc_colour_readings")).toBe(true);
    const direct = await adminClient().from("ops_qc_colour_readings").insert({ inspection_id: randomUUID(), order_id: order.id, brand_id: aliceBrand, colour_name: "Direct", delta_e: 1 });
    expect(direct.error).not.toBeNull();
  });
});

describe("third-party inspection", () => {
  it("records a booking against the order's own piece count", async () => {
    const order = await orderAt("ready");
    const id = must(
      await rpc("ops_book_inspection", { p_order_id: order.id, p_provider: "stub", p_reference: "KW-TPI-TEST", p_state: "not_available", p_requested_on: "2026-12-07", p_outcome: "Nothing was booked." }),
    ) as string;
    const row = must(await adminClient().from("ops_inspection_bookings").select("pieces, state, inspect_on, provider").eq("id", id).single());
    expect(row).toMatchObject({ pieces: 5, state: "not_available", inspect_on: null, provider: "stub" });
  });

  it("refuses a state it does not know and an order that does not exist", async () => {
    const order = await orderAt("ready");
    expect((await rpc("ops_book_inspection", { p_order_id: order.id, p_provider: "stub", p_reference: "R", p_state: "maybe", p_requested_on: "2026-12-07" })).error?.hint).toBe("invalid_input");
    expect((await rpc("ops_book_inspection", { p_order_id: randomUUID(), p_provider: "stub", p_reference: "R", p_state: "requested", p_requested_on: "2026-12-07" })).error?.code).toBe("P0002");
  });
});

describe("couriers and the parcel", () => {
  it("seeds the manual option, with no tracking page and no terms it has not agreed", async () => {
    const row = must(await adminClient().from("ops_couriers").select("name, provider, tracking_url_template, terms, transit_days").eq("code", "by-hand").single());
    expect(row).toMatchObject({ provider: "manual", tracking_url_template: null, terms: "", transit_days: null });
  });

  it("keeps the courier row and the tracking address with a parcel", async () => {
    const order = await orderAt("ready");
    must(await inspect(order.id));
    const code = `o1-courier-${randomUUID().slice(0, 8)}`;
    must(await rpc("ops_set_courier", { p_code: code, p_name: "A courier", p_provider: "manual", p_tracking_url_template: "https://track.example/{tracking}", p_terms: "", p_transit_days: null, p_active: true, p_label: "Made by the O1 test" }));
    must(
      await rpc("ops_record_shipment", {
        p_order_id: order.id, p_courier: "A courier", p_tracking_number: "T1", p_shipped_on: "2026-12-07", p_sizes: { M: 3, L: 2 },
        p_provider: "manual", p_courier_code: code, p_tracking_url: "https://track.example/T1",
      }),
    );
    const row = must(await adminClient().from("ops_shipments").select("courier_code, tracking_url, provider").eq("order_id", order.id).single());
    expect(row).toMatchObject({ courier_code: code, tracking_url: "https://track.example/T1", provider: "manual" });
  });

  it("refuses a courier that is not on file and a provider it does not know", async () => {
    const order = await orderAt("ready");
    must(await inspect(order.id));
    const parcel = { p_order_id: order.id, p_courier: "DHL", p_tracking_number: "T2", p_shipped_on: "2026-12-07", p_sizes: { M: 1 }, p_owner: "Sam", p_due_on: "2099-01-01" };
    expect((await rpc("ops_record_shipment", { ...parcel, p_courier_code: "not-a-courier" })).error?.hint).toBe("no_such_courier");
    expect((await rpc("ops_record_shipment", { ...parcel, p_provider: "pigeon" })).error?.hint).toBe("invalid_provider");
  });
});

describe("the commercial invoice", () => {
  const LINES = [{ description: "Short sleeve jersey (JSY-SS-01)", hsCode: "6110.30", originCountry: "PK", pieces: 5, unitValueMinor: 5800, lineValueMinor: 29_000 }];
  const issue = (orderId: string, over: Record<string, unknown> = {}) =>
    rpc("ops_issue_commercial_invoice", { p_order_id: orderId, p_issued_on: "2026-12-07", p_origin_country: "PK", p_destination_country: "GB", p_lines: LINES, p_preference_scheme: "DCTS", p_incoterms: "DAP", ...over });

  it("numbers the invoices of an order from 1 and keeps the order's own value", async () => {
    const order = await orderAt("ready");
    const first = must(await issue(order.id)) as { invoice_id: string; invoice_no: number }[];
    expect(first[0]!.invoice_no).toBe(1);
    const second = must(await issue(order.id, { p_replaces_id: first[0]!.invoice_id, p_missing: ["The HS code was wrong"] })) as { invoice_no: number }[];
    expect(second[0]!.invoice_no).toBe(2);
    const row = must(await adminClient().from("ops_commercial_invoices").select("total_pieces, total_value_minor, currency, preference_scheme, missing").eq("order_id", order.id).eq("invoice_no", 1).single());
    expect(row).toMatchObject({ total_pieces: 5, total_value_minor: 29_000, currency: "GBP", preference_scheme: "DCTS", missing: [] });
  });

  it("refuses an order the factory has not marked ready, and a line it cannot read", async () => {
    const waiting = await orderAt("submitted");
    expect((await issue(waiting.id)).error?.hint).toBe("not_invoiceable");
    const order = await orderAt("ready");
    expect((await issue(order.id, { p_lines: [] })).error?.hint).toBe("invalid_lines");
    expect((await issue(order.id, { p_lines: [{ ...LINES[0]!, hsCode: "not a heading" }] })).error?.hint).toBe("invalid_lines");
    expect((await issue(order.id, { p_lines: [{ ...LINES[0]!, originCountry: "Pakistan" }] })).error?.hint).toBe("invalid_lines");
  });

  it("takes a line with no HS code on file, because a guessed heading would be worse", async () => {
    const order = await orderAt("ready");
    must(await issue(order.id, { p_lines: [{ ...LINES[0]!, hsCode: null }], p_missing: ["No HS code is on file for JSY-SS-01"] }));
    const row = must(await adminClient().from("ops_commercial_invoices").select("lines, missing").eq("order_id", order.id).single()) as { lines: { hsCode: string | null }[]; missing: string[] };
    expect(row.lines[0]!.hsCode).toBeNull();
    expect(row.missing[0]).toContain("No HS code is on file");
  });

  it("is append-only: an invoice stands once issued", async () => {
    const order = await orderAt("ready");
    must(await issue(order.id));
    const change = await adminClient().from("ops_commercial_invoices").update({ incoterms: "EXW" }).eq("order_id", order.id);
    expect(refusedAsReadOnly(change.error, "ops_commercial_invoices")).toBe(true);
  });
});

describe("customer status emails", () => {
  const send = (orderId: string, over: Record<string, unknown> = {}) =>
    rpc("ops_record_customer_email", { p_order_id: orderId, p_kind: "in_production", p_to_email: "club@example.com", p_subject: "KW: in production", p_body: "words", p_provider: "none", p_sent: false, p_reason: "No email provider is set up.", ...over });

  it("keeps the words that went out, or the reason nothing did", async () => {
    const order = await orderAt("ready");
    const id = must(await send(order.id)) as string;
    const row = must(await adminClient().from("ops_customer_emails").select("kind, sent, reason, provider, body").eq("id", id).single());
    expect(row).toMatchObject({ kind: "in_production", sent: false, provider: "none", body: "words" });
    expect((row as { reason: string }).reason).toContain("No email provider");
  });

  it("will not record a message as not sent without saying why", async () => {
    const order = await orderAt("ready");
    expect((await send(order.id, { p_reason: "" })).error?.hint).toBe("reason_needed");
  });

  it("refuses an address and a kind it does not know", async () => {
    const order = await orderAt("ready");
    expect((await send(order.id, { p_to_email: "not-an-address" })).error?.hint).toBe("invalid_input");
    expect((await send(order.id, { p_kind: "whenever" })).error?.hint).toBe("invalid_kind");
  });

  it("is append-only", async () => {
    const order = await orderAt("ready");
    must(await send(order.id));
    const change = await adminClient().from("ops_customer_emails").update({ sent: true }).eq("order_id", order.id);
    expect(refusedAsReadOnly(change.error, "ops_customer_emails")).toBe(true);
  });
});

describe("who reaches the new tables", () => {
  it("lets a platform admin read them and a member read none of them", async () => {
    const order = await orderAt("ready");
    must(await inspect(order.id, { p_colour_readings: [{ colourName: "Kit navy", deltaE: 1 }] }));
    for (const table of ["ops_cut_runs", "ops_qc_colour_readings", "ops_inspection_bookings", "ops_commercial_invoices", "ops_customer_emails"]) {
      const asAdmin = await admin.client.from(table).select("id").limit(1);
      expect(asAdmin.error, `${table} as a platform admin`).toBeNull();
      const asMember = await alice.client.from(table).select("id").limit(1);
      expect(asMember.data ?? [], `${table} as a member`).toHaveLength(0);
    }
  });

  it("gives the service role no way to write them directly", async () => {
    const order = await orderAt("ready");
    const attempts: readonly [string, Record<string, unknown>][] = [
      ["ops_cut_runs", { cut_for: new Date().toISOString() }],
      ["ops_inspection_bookings", { order_id: order.id, brand_id: aliceBrand, provider: "x", reference: "r", pieces: 1, requested_on: "2026-12-07", state: "requested" }],
      ["ops_commercial_invoices", { order_id: order.id, brand_id: aliceBrand, invoice_no: 9, issued_on: "2026-12-07", origin_country: "PK", destination_country: "GB", lines: [], total_pieces: 1 }],
      ["ops_customer_emails", { order_id: order.id, brand_id: aliceBrand, kind: "ready", to_email: "a@b.co", subject: "s", body: "b", provider: "none", sent: false, reason: "r" }],
    ];
    for (const [table, row] of attempts) expect((await adminClient().from(table).insert(row)).error, table).not.toBeNull();
  });
});
