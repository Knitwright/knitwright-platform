import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { buildSeedTemplates } from "@/lib/templates/seed/build";
import {
  acceptSubmission, createSubmission, designerFailure, enrol, loadDesignChoices, loadDesignerHome, loadDecided, loadDesignerRows, loadLedger,
  loadPayoutStates, loadProfile, loadRate, loadReviewQueue, loadSubmissions, rejectSubmission, sendSubmission, setPayoutState,
} from "./service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const spec = buildSeedTemplates()[0]!.snapshot;

type Reply = { data: unknown; error: { message: string; code?: string; hint?: string } | null };

/** A client whose every table answers as the map says; the query chain is thenable and records its filters. */
function reads(tables: Record<string, Reply>) {
  const filters: string[] = [];
  const client = {
    from: (table: string) => {
      const reply = tables[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "eq", "in"]) q[m] = (...a: unknown[]) => (m === "eq" || m === "in" ? filters.push(`${m}:${String(a[0])}`) : 0, q);
      q.maybeSingle = async () => ({ data: Array.isArray(reply.data) ? (reply.data[0] ?? null) : reply.data, error: reply.error });
      q.then = (ok: (r: Reply) => unknown) => Promise.resolve(reply).then(ok);
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, filters };
}

function writes(reply: Reply = { data: null, error: null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), reply) } as unknown as SupabaseClient;
  return { client, calls };
}

const submission = (over: Record<string, unknown> = {}) => ({
  id: A, designer_id: B, title: "Hoops", sport: "football", article_id: "team-jersey", style_tags: ["hoops"], colour_family: "blue",
  status: "submitted", rejection_reason: null, rights_attested: true, template_id: null, created_at: "2026-10-28T00:00:00Z", ...over,
});

describe("the writes", () => {
  it("enrol, send, reject and set a payout call their database function with the person as the actor", async () => {
    const { client, calls } = writes();
    await enrol(client, B, "Ada");
    await sendSubmission(client, B, A);
    await rejectSubmission(client, B, A, "No");
    await setPayoutState(client, B, A, "on_hold", "wait");
    expect(calls.map((c) => c.fn)).toEqual(["designer_enrol", "template_submission_submit", "template_submission_reject", "designer_set_payout_state"]);
    expect(calls[1]!.args).toMatchObject({ p_user_id: B, p_rights_attested: true });
    expect(calls[3]!.args).toMatchObject({ p_actor: B, p_designer_id: A, p_state: "on_hold" });
  });

  it("accept returns the new template id", async () => {
    expect(await acceptSubmission(writes({ data: A, error: null }).client, B, A)).toBe(A);
  });

  it("says a refusal in words by its hint, and maps the rest as other writes do", async () => {
    const hinted = writes({ data: null, error: { message: "x", hint: "rights_required" } }).client;
    await expect(sendSubmission(hinted, B, A)).rejects.toMatchObject({ code: "invalid_input", message: expect.stringMatching(/rights/) });
    expect(designerFailure({ message: "x", code: "P0002" })).toMatchObject({ code: "not_found" });
    expect(designerFailure({ message: "x", code: "XX000" })).toBeInstanceOf(AppError);
  });
});

describe("createSubmission", () => {
  const input = { projectId: A, title: "Hoops", sport: "football", style: "hoops", colourFamily: "blue" } as const;
  const member = (spec_: unknown, project: unknown = { current_version: 3 }) =>
    reads({ projects: { data: project, error: null }, spec_versions: { data: spec_ === undefined ? null : { spec: spec_ }, error: null } }).client;

  it("freezes the newest version of the member's design as a draft", async () => {
    const { client, calls } = writes({ data: A, error: null });
    expect(await createSubmission(client, member(spec), B, input)).toBe(A);
    expect(calls[0]!.args).toMatchObject({ p_user_id: B, p_title: "Hoops", p_style_tags: ["hoops"], p_article_id: "team-jersey" });
    expect(calls[0]!.args.p_snapshot).toMatchObject({ typeId: "team-jersey" });
  });

  it("refuses a design the member cannot see, and one that cannot be read as a design", async () => {
    await expect(createSubmission(writes().client, member(spec, null), B, input)).rejects.toMatchObject({ code: "not_found" });
    await expect(createSubmission(writes().client, member({ not: "a design" }), B, input)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("reports unreadable tables", async () => {
    const broken = reads({ projects: { data: null, error: { message: "boom" } } }).client;
    await expect(createSubmission(writes().client, broken, B, input)).rejects.toMatchObject({ code: "internal" });
    const noVersion = reads({ projects: { data: { current_version: 1 }, error: null }, spec_versions: { data: null, error: { message: "boom" } } }).client;
    await expect(createSubmission(writes().client, noVersion, B, input)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("the reads", () => {
  it("reads a profile, or none", async () => {
    expect(await loadProfile(reads({ designer_profiles: { data: { user_id: A, display_name: "Ada" }, error: null } }).client, A)).toEqual({ userId: A, displayName: "Ada" });
    expect(await loadProfile(reads({ designer_profiles: { data: null, error: null } }).client, A)).toBeNull();
    await expect(loadProfile(reads({ designer_profiles: { data: null, error: { message: "x" } } }).client, A)).rejects.toBeInstanceOf(AppError);
  });

  it("reads only the named designer's submissions", async () => {
    const { client, filters } = reads({ template_submissions: { data: [submission({ status: "rejected", rejection_reason: "No", style_tags: [] })], error: null } });
    const [one] = await loadSubmissions(client, B);
    expect(one).toMatchObject({ status: "rejected", rejectionReason: "No", style: "plain" });
    expect(filters).toContain("eq:designer_id");
    await expect(loadSubmissions(reads({ template_submissions: { data: null, error: { message: "x" } } }).client, B)).rejects.toBeInstanceOf(AppError);
  });

  it("lists the review queue with names and designs, and falls back to 'Designer'", async () => {
    const tables = { template_submissions: { data: [{ ...submission(), snapshot: spec }], error: null }, designer_profiles: { data: [{ user_id: B, display_name: "Ada" }], error: null } };
    const [entry] = await loadReviewQueue(reads(tables).client);
    expect(entry).toMatchObject({ designerName: "Ada", submission: { id: A } });
    const [anon] = await loadReviewQueue(reads({ ...tables, designer_profiles: { data: [], error: null } }).client);
    expect(anon!.designerName).toBe("Designer");
    expect(await loadReviewQueue(reads({ template_submissions: { data: [], error: null } }).client)).toEqual([]);
    await expect(loadReviewQueue(reads({ template_submissions: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
    await expect(loadReviewQueue(reads({ ...tables, designer_profiles: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
  });

  it("lists decided submissions with the designer's name", async () => {
    const tables = { template_submissions: { data: [submission({ status: "approved" })], error: null }, designer_profiles: { data: [{ user_id: B, display_name: "Ada" }], error: null } };
    const { client, filters } = reads(tables);
    expect(await loadDecided(client)).toMatchObject([{ designerName: "Ada", submission: { status: "approved" } }]);
    expect(filters).toContain("in:status");
    const [anon] = await loadDecided(reads({ ...tables, designer_profiles: { data: [], error: null } }).client);
    expect(anon!.designerName).toBe("Designer");
    await expect(loadDecided(reads({ template_submissions: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
  });

  it("reads an empty answer (no rows, no error) as nothing", async () => {
    const none = reads({ template_submissions: { data: null, error: null }, designer_profiles: { data: null, error: null }, royalty_accruals: { data: null, error: null }, designer_payout_state: { data: null, error: null }, projects: { data: null, error: null } }).client;
    expect(await loadSubmissions(none, B)).toEqual([]);
    expect(await loadReviewQueue(none)).toEqual([]);
    expect(await loadDecided(none)).toEqual([]);
    expect((await loadLedger(none)).size).toBe(0);
    expect((await loadPayoutStates(none)).size).toBe(0);
    expect(await loadDesignerRows(none)).toEqual([]);
    expect(await loadDesignChoices(none, A)).toEqual([]);
  });

  const lines = [
    { designer_id: B, units: 10, rate_minor: 50, currency: "AUD", accrued_minor: 500 },
    { designer_id: B, units: 5, rate_minor: null, currency: null, accrued_minor: 0 },
    { designer_id: A, units: 2, rate_minor: null, currency: null, accrued_minor: 0 },
  ];

  it("groups ledger lines by designer, for one or for all", async () => {
    const { client, filters } = reads({ royalty_accruals: { data: lines, error: null } });
    const all = await loadLedger(client);
    expect([...all.keys()].sort()).toEqual([A, B]);
    expect(filters).not.toContain("eq:designer_id");
    await loadLedger(client, B);
    expect(filters).toContain("eq:designer_id");
    await expect(loadLedger(reads({ royalty_accruals: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
  });

  it("reads the latest payout state, and the home of one designer", async () => {
    const tables = {
      designer_payout_events: { data: [{ designer_id: B, state: "on_hold" }, { designer_id: B, state: "paid" }], error: null },
      royalty_accruals: { data: lines, error: null },
      template_submissions: { data: [submission({ status: "approved", template_id: A })], error: null },
    };
    const { client } = reads(tables);
    expect((await loadPayoutStates(client)).get(B)).toBe("paid");
    const home = await loadDesignerHome(client, B);
    expect(home).toMatchObject({ liveTemplates: 1, payoutState: "paid", ledger: { units: 15, linesWithoutRate: 1 } });
    const fresh = await loadDesignerHome(reads({ template_submissions: { data: [], error: null } }).client, B);
    expect(fresh).toMatchObject({ liveTemplates: 0, payoutState: "not_paid", ledger: { units: 0 } });
    await expect(loadPayoutStates(reads({ designer_payout_events: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
  });

  it("lists every designer with units, money and payout state", async () => {
    const { client } = reads({
      designer_profiles: { data: [{ user_id: B, display_name: "Ada" }, { user_id: A, display_name: "Bo" }], error: null },
      royalty_accruals: { data: lines, error: null },
    });
    const rows = await loadDesignerRows(client);
    expect(rows[0]).toMatchObject({ name: "Ada", payoutState: "not_paid", ledger: { units: 15, accrued: [{ currency: "AUD", minor: 500 }] } });
    expect(rows[1]).toMatchObject({ name: "Bo", ledger: { units: 2, accrued: [] } });
    await expect(loadDesignerRows(reads({ designer_profiles: { data: null, error: { message: "x" } } }).client)).rejects.toBeInstanceOf(AppError);
  });

  it("reads the rate: null while not set, the number when set", async () => {
    const stored = (value: unknown) =>
      reads({ platform_settings: { data: value === undefined ? [] : [{ key: "designer.royalty_per_unit", value, set_by: null, set_at: "2026-10-28T00:00:00Z" }], error: null } }).client;
    expect(await loadRate(stored(undefined))).toBeNull();
    expect(await loadRate(stored(40))).toBe(40);
    expect(await loadRate(stored("lots"))).toBeNull();
  });

  it("lists the brand's designs for the form", async () => {
    expect(await loadDesignChoices(reads({ projects: { data: [{ id: A, name: "Home kit" }], error: null } }).client, B)).toEqual([{ id: A, name: "Home kit" }]);
    await expect(loadDesignChoices(reads({ projects: { data: null, error: { message: "x" } } }).client, B)).rejects.toBeInstanceOf(AppError);
  });
});
