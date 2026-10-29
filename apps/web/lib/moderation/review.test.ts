import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import {
  addMark, decideNotice, listMarks, listNotices, listQueue, markActiveSchema, markSchema, noticeDecisionSchema,
  reviewCheck, reviewSchema, saveReport, setMarkActive, strikesByBrand, type Notice,
} from "./review";
import { DEFAULT_SETTINGS } from "./settings";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const HASH = "f".repeat(32);

type Reply = { data: unknown; error: { message: string; code?: string; hint?: string } | null };

function reads(tables: Record<string, Reply>) {
  const filters: string[] = [];
  const client = {
    from: (table: string) => {
      const reply = tables[table] ?? { data: [], error: null };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "eq", "in", "is", "neq"]) {
        q[m] = (...a: unknown[]) => (filters.push(`${m}:${String(a[0])}${a.length > 1 && typeof a[1] !== "object" ? `=${String(a[1])}` : ""}`), q);
      }
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

const checkRow = (over: Record<string, unknown> = {}) => ({
  id: A, brand_id: B, target_kind: "asset", target_id: A, hook: "upload", label: "crest.png", result: "flagged",
  reasons: [{ code: "brand_term", severity: "flag", message: "A brand name.", ruleId: "R-GAP-000", term: "Nike" }],
  created_at: "2026-10-28T09:00:00Z", ...over,
});

const noticeRow = (over: Record<string, unknown> = {}) => ({
  id: A, reporter_name: "Ada", reporter_email: "ada@example.com", holder: "Nike, Inc.", mark: "Swoosh", location: "A product",
  details: "", status: "received", brand_id: null, strike_number: null, created_at: "2026-10-28T09:00:00Z", ...over,
});

describe("the review queue", () => {
  it("reads flagged and blocked checks nobody has decided, oldest first", async () => {
    const { client, filters } = reads({ moderation_checks: { data: [checkRow()], error: null } });
    const queue = await listQueue(client);
    expect(queue[0]).toMatchObject({ id: A, brandId: B, targetKind: "asset", hook: "upload", result: "flagged" });
    expect(queue[0]!.reasons[0]).toMatchObject({ code: "brand_term", ruleId: "R-GAP-000" });
    expect(filters).toContain("is:decision");
    expect(filters).toContain("neq:result=clear");
  });

  it("gives a reason with no rule id the gap id, so every finding carries one", async () => {
    const { client } = reads({ moderation_checks: { data: [checkRow({ reasons: [{ code: "x", severity: "flag", message: "m" }] })], error: null } });
    expect((await listQueue(client))[0]!.reasons[0]!.ruleId).toBe("R-GAP-000");
  });

  it("answers with an empty queue, and says a failure in words", async () => {
    expect(await listQueue(reads({ moderation_checks: { data: null, error: null } }).client)).toEqual([]);
    await expect(listQueue(reads({ moderation_checks: { data: null, error: { message: "down" } } }).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("the takedown notices", () => {
  it("puts the open ones first, oldest open first, then the decided ones", async () => {
    const rows = [
      noticeRow({ id: "d1", status: "upheld", brand_id: B, strike_number: 1, created_at: "2026-10-28T12:00:00Z" }),
      noticeRow({ id: "o2", created_at: "2026-10-28T11:00:00Z" }),
      noticeRow({ id: "o1", created_at: "2026-10-28T10:00:00Z" }),
    ];
    const notices = await listNotices(reads({ takedown_notices: { data: rows, error: null } }).client);
    expect(notices.map((n) => n.id)).toEqual(["o1", "o2", "d1"]);
    expect(notices[0]).toMatchObject({ reporterName: "Ada", reporterEmail: "ada@example.com", holder: "Nike, Inc." });
  });

  it("answers with no notices, and says a failure in words", async () => {
    expect(await listNotices(reads({ takedown_notices: { data: null, error: null } }).client)).toEqual([]);
    await expect(listNotices(reads({ takedown_notices: { data: null, error: { message: "down" } } }).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("the repeat-infringer count", () => {
  const notice = (brandId: string | null, status: Notice["status"]): Notice => ({
    id: A, reporterName: "", reporterEmail: "", holder: "", mark: "", location: "", details: "",
    status, brandId, strikeNumber: null, createdAt: "2026-10-28T09:00:00Z",
  });

  it("counts upheld notices per brand, most first, and marks a brand at the threshold", () => {
    const notices = [
      ...Array.from({ length: 3 }, () => notice(B, "upheld")),
      notice(A, "upheld"),
      notice(A, "rejected"),
      notice(null, "upheld"),
      notice(B, "received"),
    ];
    expect(strikesByBrand(notices, DEFAULT_SETTINGS)).toEqual([
      { brandId: B, upheld: 3, repeatInfringer: true },
      { brandId: A, upheld: 1, repeatInfringer: false },
    ]);
  });

  it("counts nothing when no notice was upheld", () => {
    expect(strikesByBrand([notice(B, "received")], DEFAULT_SETTINGS)).toEqual([]);
  });

  it("sorts two brands with the same count by id, so the page never reshuffles", () => {
    const counted = strikesByBrand([notice(B, "upheld"), notice(A, "upheld")], DEFAULT_SETTINGS);
    expect(counted.map((s) => s.brandId)).toEqual([A, B]);
  });
});

describe("the mark registry", () => {
  it("reads every mark, on or off", async () => {
    const rows = [{ id: A, holder: "Nike, Inc.", mark_text: "Nike", image_hash: null, source: "knitwright-default", active: true }];
    expect(await listMarks(reads({ rights_holder_marks: { data: rows, error: null } }).client)).toEqual([
      { id: A, holder: "Nike, Inc.", markText: "Nike", imageHash: null, source: "knitwright-default", active: true },
    ]);
    expect(await listMarks(reads({ rights_holder_marks: { data: null, error: null } }).client)).toEqual([]);
    await expect(listMarks(reads({ rights_holder_marks: { data: null, error: { message: "down" } } }).client)).rejects.toBeInstanceOf(AppError);
  });
});

describe("the writes", () => {
  it("each call its own database function with the person as the actor", async () => {
    const { client, calls } = writes({ data: A, error: null });
    await reviewCheck(client, ACTOR, { checkId: A, decision: "allowed", reason: "Their own club" });
    await setMarkActive(client, ACTOR, { markId: A, active: false });
    expect(calls.map((c) => c.fn)).toEqual(["moderation_review", "rights_mark_set_active"]);
    expect(calls[0]!.args).toMatchObject({ p_actor: ACTOR, p_check_id: A, p_decision: "allowed", p_reason: "Their own club" });
    expect(calls[1]!.args).toMatchObject({ p_actor: ACTOR, p_mark_id: A, p_active: false });
  });

  it("adds a mark and answers with its id", async () => {
    const { client, calls } = writes({ data: A, error: null });
    expect(await addMark(client, ACTOR, { holder: "Nike, Inc.", markText: "Nike", imageHash: "", contact: "", source: "ops" })).toBe(A);
    expect(calls[0]!.args).toMatchObject({ p_holder: "Nike, Inc.", p_mark_text: "Nike", p_source: "ops" });
  });

  it("upholds a notice against a brand and answers with the strike number; a rejection names no brand", async () => {
    const upheld = writes({ data: 2, error: null });
    expect(await decideNotice(upheld.client, ACTOR, { noticeId: A, status: "upheld", brandId: B, note: "Theirs" })).toBe(2);
    expect(upheld.calls[0]!.args).toMatchObject({ p_brand_id: B, p_status: "upheld" });
    const rejected = writes({ data: null, error: null });
    expect(await decideNotice(rejected.client, ACTOR, { noticeId: A, status: "rejected", brandId: "", note: "Not a mark" })).toBeNull();
    expect(rejected.calls[0]!.args.p_brand_id).toBeNull();
  });

  it("keeps a public report", async () => {
    const { client, calls } = writes({ data: A, error: null });
    const report = { reporterName: "Ada", reporterEmail: "ada@example.com", holder: "Nike, Inc.", mark: "Swoosh", location: "A product", details: "" };
    expect(await saveReport(client, report)).toBe(A);
    expect(calls[0]!.fn).toBe("takedown_submit");
    expect(calls[0]!.args).toMatchObject({ p_reporter_name: "Ada", p_mark: "Swoosh" });
  });

  it("says a refusal in the words its hint names", async () => {
    const already = writes({ data: null, error: { message: "x", hint: "invalid_transition" } }).client;
    await expect(reviewCheck(already, ACTOR, { checkId: A, decision: "allowed", reason: "ok" })).rejects.toMatchObject({ code: "conflict", message: "This item has already been decided." });
  });
});

describe("the forms", () => {
  it("asks for a reason on every decision", () => {
    expect(reviewSchema.safeParse({ checkId: A, decision: "allowed", reason: " " }).success).toBe(false);
    expect(reviewSchema.safeParse({ checkId: A, decision: "allowed", reason: "x".repeat(501) }).success).toBe(false);
    expect(reviewSchema.safeParse({ checkId: A, decision: "blocked", reason: "Someone else's crest" }).success).toBe(true);
  });

  it("asks which brand an upheld notice is about, but not for a rejection", () => {
    expect(noticeDecisionSchema.safeParse({ noticeId: A, status: "upheld", note: "Theirs" }).success).toBe(false);
    expect(noticeDecisionSchema.safeParse({ noticeId: A, status: "upheld", brandId: B, note: "Theirs" }).success).toBe(true);
    expect(noticeDecisionSchema.safeParse({ noticeId: A, status: "rejected", note: "Not a mark" }).success).toBe(true);
  });

  it("takes a mark by name, by picture or both, and nothing else", () => {
    expect(markSchema.safeParse({ holder: "Nike, Inc.", markText: "Nike" }).success).toBe(true);
    expect(markSchema.safeParse({ holder: "Nike, Inc.", imageHash: HASH }).success).toBe(true);
    expect(markSchema.safeParse({ holder: "Nike, Inc." }).success).toBe(false);
    expect(markSchema.safeParse({ holder: "Nike, Inc.", markText: "N" }).success).toBe(false);
    expect(markSchema.safeParse({ holder: "", markText: "Nike" }).success).toBe(false);
    const short = markSchema.safeParse({ holder: "Nike, Inc.", markText: "Nike", imageHash: "f".repeat(16) });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toMatch(/32 hex digits/);
  });

  it("reads the on-or-off switch as a yes or no", () => {
    expect(markActiveSchema.parse({ markId: A, active: "false" })).toEqual({ markId: A, active: false });
    expect(markActiveSchema.parse({ markId: A, active: "true" }).active).toBe(true);
    expect(markActiveSchema.safeParse({ markId: A, active: "maybe" }).success).toBe(false);
  });
});
