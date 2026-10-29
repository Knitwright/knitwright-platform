import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261101070000: moderation and IP basics (decision 0073, spec F-G1). A screening result is kept by
 * `moderation_record` and never changes; only a platform admin may decide one, once, with a reason; a Class B run asks
 * `moderation_human_allowed`, which goes back to false the moment anything about the version is flagged again; the registry and
 * the takedown notices are written only by their functions, and an upheld notice counts the brand's strikes. Needs `pnpm db:start`.
 */

let owner: Person;
let member: Person;
let admin: Person;
let brand: string;

const rpc = (fn: string, args: Record<string, unknown>) => adminClient().rpc(fn, args);
const asAdmin = (fn: string, args: Record<string, unknown>) => rpc(fn, { p_actor: admin.userId, ...args });

const reasons = (severity: "note" | "flag" | "block") => [{ code: "brand_term", severity, message: "A registered name.", ruleId: "R-GAP-000", term: "Nike" }];
const resultOf = { note: "clear", flag: "flagged", block: "blocked" } as const;

/** One screening of a target, with the worst severity in its reasons. */
const record = async (over: Record<string, unknown> = {}) =>
  rpc("moderation_record", {
    p_brand_id: brand, p_user_id: owner.userId, p_target_kind: "asset", p_target_id: randomUUID(), p_hook: "upload",
    p_label: "crest.png", p_subject_sha256: null, p_result: "flagged", p_reasons: reasons("flag"), ...over,
  });

const recorded = async (over: Record<string, unknown> = {}): Promise<string> => must(await record(over)) as string;

const versionCheck = (versionId: string, severity: "note" | "flag" | "block") =>
  recorded({ p_target_kind: "version", p_target_id: versionId, p_hook: "order", p_result: resultOf[severity], p_reasons: reasons(severity) });

const allowed = async (versionId: string): Promise<boolean> =>
  must(await rpc("moderation_human_allowed", { p_target_kind: "version", p_target_id: versionId })) as boolean;

beforeAll(async () => {
  [owner, member, admin] = await Promise.all([person("mod-owner"), person("mod-member"), person("mod-admin")]);
  brand = await brandOf(owner, "Moderation FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("keeping a screening result", () => {
  it("keeps the reasons and the hook, and names the person who uploaded", async () => {
    const id = await recorded();
    const row = must(await adminClient().from("moderation_checks").select("*").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: brand, created_by: owner.userId, target_kind: "asset", hook: "upload", result: "flagged", decision: null });
    expect(row.reasons).toEqual(reasons("flag"));
  });

  it("refuses a result that does not match its reasons, so the queue can never be wrong", async () => {
    expect((await record({ p_result: "clear", p_reasons: reasons("block") })).error?.hint).toBe("invalid_input");
    expect((await record({ p_result: "blocked", p_reasons: reasons("flag") })).error?.hint).toBe("invalid_input");
    expect((await record({ p_result: "flagged", p_reasons: reasons("note") })).error?.hint).toBe("invalid_input");
  });

  it("takes a note-only screening as clear", async () => {
    const id = await recorded({ p_result: "clear", p_reasons: reasons("note") });
    expect(must(await adminClient().from("moderation_checks").select("result").eq("id", id).single())).toMatchObject({ result: "clear" });
  });

  it("refuses reasons that are not a list of objects with words in them", async () => {
    for (const bad of [{ code: "x" }, [{ code: 1, message: "m" }], ["a string"], null]) {
      expect((await record({ p_reasons: bad })).error, JSON.stringify(bad)).not.toBeNull();
    }
  });

  it("refuses a reason with no rule id: every finding carries one (plan v5 rules)", async () => {
    const noRule = [{ code: "brand_term", severity: "flag", message: "A registered name." }];
    expect((await record({ p_reasons: noRule })).error?.hint).toBe("invalid_input");
    const noCode = [{ severity: "flag", message: "A registered name.", ruleId: "R-GAP-000" }];
    expect((await record({ p_reasons: noCode })).error?.hint).toBe("invalid_input");
  });

  it("keeps a refused upload with no asset to point at", async () => {
    const id = await recorded({ p_target_id: null, p_result: "blocked", p_reasons: reasons("block") });
    expect(must(await adminClient().from("moderation_checks").select("target_id").eq("id", id).single())).toMatchObject({ target_id: null });
  });

  it("refuses a result for a person who does not belong to the brand", async () => {
    expect((await record({ p_user_id: member.userId })).error?.code).toBe("P0002");
  });

  it("takes a result with nobody named, for a screening the server ran on its own", async () => {
    expect(await recorded({ p_user_id: null })).toBeTruthy();
  });

  it("cuts a label longer than the column takes rather than refusing the screening", async () => {
    const id = await recorded({ p_label: "x".repeat(900) });
    const row = must(await adminClient().from("moderation_checks").select("label").eq("id", id).single()) as { label: string };
    expect(row.label).toHaveLength(500);
  });
});

describe("a result can never be changed", () => {
  it("has no way in through the server's own key: it holds SELECT and nothing else", async () => {
    const id = await recorded();
    expect((await adminClient().from("moderation_checks").update({ result: "clear" }).eq("id", id)).error).not.toBeNull();
    expect((await adminClient().from("moderation_checks").delete().eq("id", id)).error).not.toBeNull();
    expect(must(await adminClient().from("moderation_checks").select("result").eq("id", id).single())).toMatchObject({ result: "flagged" });
  });

  it("lets a brand's rows go when the account that owns it is deleted", async () => {
    const other = await person("mod-cascade");
    const otherBrand = await brandOf(other, "Gone FC");
    const id = must(await rpc("moderation_record", {
      p_brand_id: otherBrand, p_user_id: other.userId, p_target_kind: "text", p_target_id: null, p_hook: "text",
      p_label: "Nike", p_subject_sha256: null, p_result: "flagged", p_reasons: reasons("flag"),
    })) as string;
    must(await rpc("delete_account_data", { p_user_id: other.userId }));
    expect(must(await adminClient().from("moderation_checks").select("id").eq("id", id))).toEqual([]);
  });
});

describe("a person's decision", () => {
  it("is for platform admins only, and anyone else is told it is not there", async () => {
    const id = await recorded();
    expect((await rpc("moderation_review", { p_actor: member.userId, p_check_id: id, p_decision: "allowed", p_reason: "Fine" })).error).not.toBeNull();
    expect(must(await adminClient().from("moderation_checks").select("decision").eq("id", id).single())).toMatchObject({ decision: null });
  });

  it("needs a reason, and takes allow or block only", async () => {
    const id = await recorded();
    expect((await asAdmin("moderation_review", { p_check_id: id, p_decision: "allowed", p_reason: "   " })).error?.hint).toBe("reason_needed");
    expect((await asAdmin("moderation_review", { p_check_id: id, p_decision: "maybe", p_reason: "Fine" })).error?.hint).toBe("invalid_input");
  });

  it("is made once, and names the reviewer and the time", async () => {
    const id = await recorded();
    must(await asAdmin("moderation_review", { p_check_id: id, p_decision: "allowed", p_reason: "Their own club crest" }));
    const row = must(await adminClient().from("moderation_checks").select("decision, decision_reason, reviewer, reviewed_at").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ decision: "allowed", decision_reason: "Their own club crest", reviewer: admin.userId });
    expect(row.reviewed_at).not.toBeNull();
    expect((await asAdmin("moderation_review", { p_check_id: id, p_decision: "blocked", p_reason: "Changed my mind" })).error?.hint).toBe("invalid_transition");
  });

  it("has nothing to decide on a clear result, and nothing at all on a check that is not there", async () => {
    const clear = await recorded({ p_result: "clear", p_reasons: [] });
    expect((await asAdmin("moderation_review", { p_check_id: clear, p_decision: "allowed", p_reason: "Fine" })).error?.hint).toBe("invalid_transition");
    expect((await asAdmin("moderation_review", { p_check_id: randomUUID(), p_decision: "allowed", p_reason: "Fine" })).error?.code).toBe("P0002");
  });
});

describe("the guard a Class B run passes", () => {
  it("says no until a person has allowed the version, then yes", async () => {
    const version = randomUUID();
    expect(await allowed(version)).toBe(false);
    const check = await versionCheck(version, "flag");
    expect(await allowed(version)).toBe(false);
    must(await asAdmin("moderation_review", { p_check_id: check, p_decision: "allowed", p_reason: "Looked at it" }));
    expect(await allowed(version)).toBe(true);
  });

  it("says no again when anything about the version is flagged after the decision", async () => {
    const version = randomUUID();
    must(await asAdmin("moderation_review", { p_check_id: await versionCheck(version, "flag"), p_decision: "allowed", p_reason: "Looked at it" }));
    await versionCheck(version, "flag");
    expect(await allowed(version)).toBe(false);
  });

  it("stays yes when the only screening since was clear", async () => {
    const version = randomUUID();
    must(await asAdmin("moderation_review", { p_check_id: await versionCheck(version, "flag"), p_decision: "allowed", p_reason: "Looked at it" }));
    await versionCheck(version, "note");
    expect(await allowed(version)).toBe(true);
  });

  it("says no when a later screening was blocked by a person", async () => {
    const version = randomUUID();
    must(await asAdmin("moderation_review", { p_check_id: await versionCheck(version, "flag"), p_decision: "allowed", p_reason: "Looked at it" }));
    const later = await versionCheck(version, "block");
    must(await asAdmin("moderation_review", { p_check_id: later, p_decision: "blocked", p_reason: "Someone else's crest" }));
    expect(await allowed(version)).toBe(false);
  });
});

describe("the mark registry", () => {
  const markText = () => `Mark ${randomUUID().slice(0, 8)}`;

  it("is added to by platform admins only", async () => {
    const args = { p_holder: "Nike, Inc.", p_mark_text: markText(), p_image_hash: null, p_contact: "", p_source: "ops" };
    expect((await rpc("rights_mark_add", { p_actor: member.userId, ...args })).error).not.toBeNull();
    expect(must(await asAdmin("rights_mark_add", args))).toBeTruthy();
  });

  it("takes a name, a picture hash of 32 hex digits, or both, and nothing shorter", async () => {
    const hash = "a1b2c3d4".repeat(4);
    expect(must(await asAdmin("rights_mark_add", { p_holder: "Picture only", p_mark_text: "", p_image_hash: hash, p_contact: "", p_source: "ops" }))).toBeTruthy();
    expect((await asAdmin("rights_mark_add", { p_holder: "Too short", p_mark_text: "", p_image_hash: "a".repeat(16), p_contact: "", p_source: "ops" })).error).not.toBeNull();
    expect((await asAdmin("rights_mark_add", { p_holder: "Nothing at all", p_mark_text: "", p_image_hash: null, p_contact: "", p_source: "ops" })).error).not.toBeNull();
  });

  it("says where a mark came from, and refuses to pass a row off as the Knitwright starting list", async () => {
    expect((await asAdmin("rights_mark_add", { p_holder: "Faker", p_mark_text: markText(), p_image_hash: null, p_contact: "", p_source: "knitwright-default" })).error?.hint).toBe("invalid_input");
    expect(must(await asAdmin("rights_mark_add", { p_holder: "A club", p_mark_text: markText(), p_image_hash: null, p_contact: "legal@example.com", p_source: "rights-holder" }))).toBeTruthy();
  });

  it("holds one row per name, whatever its case or spacing", async () => {
    const text = markText();
    must(await asAdmin("rights_mark_add", { p_holder: "First", p_mark_text: text, p_image_hash: null, p_contact: "", p_source: "ops" }));
    expect((await asAdmin("rights_mark_add", { p_holder: "Second", p_mark_text: ` ${text.toUpperCase()} `, p_image_hash: null, p_contact: "", p_source: "ops" })).error).not.toBeNull();
  });

  it("is switched off by platform admins only, and says so when the mark is not there", async () => {
    const id = must(await asAdmin("rights_mark_add", { p_holder: "Switchable", p_mark_text: markText(), p_image_hash: null, p_contact: "", p_source: "ops" })) as string;
    expect((await rpc("rights_mark_set_active", { p_actor: member.userId, p_mark_id: id, p_active: false })).error).not.toBeNull();
    must(await asAdmin("rights_mark_set_active", { p_mark_id: id, p_active: false }));
    expect(must(await adminClient().from("rights_holder_marks").select("active").eq("id", id).single())).toMatchObject({ active: false });
    expect((await asAdmin("rights_mark_set_active", { p_mark_id: randomUUID(), p_active: false })).error?.code).toBe("P0002");
  });

  it("starts with a labelled list of third-party names, Nike among them", async () => {
    const rows = must(await adminClient().from("rights_holder_marks").select("mark_text").eq("source", "knitwright-default")) as { mark_text: string }[];
    expect(rows.map((r) => r.mark_text)).toContain("Nike");
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });
});

describe("a rights holder's report", () => {
  const submit = (over: Record<string, unknown> = {}) =>
    rpc("takedown_submit", {
      p_reporter_name: "Ada Lovelace", p_reporter_email: " Ada@Example.COM ", p_holder: "Nike, Inc.", p_mark: "The swoosh",
      p_location: "https://example.com/a-product", p_details: "", ...over,
    });

  it("is kept with the address in lower case and nothing decided", async () => {
    const id = must(await submit()) as string;
    expect(must(await adminClient().from("takedown_notices").select("*").eq("id", id).single())).toMatchObject({
      reporter_email: "ada@example.com", holder: "Nike, Inc.", status: "received", brand_id: null, strike_number: null, decided_at: null,
    });
  });

  it("asks for a name, an address, the owner, the mark and where it was seen", async () => {
    for (const field of ["p_reporter_name", "p_holder", "p_mark", "p_location"]) {
      expect((await submit({ [field]: "   " })).error, field).not.toBeNull();
    }
    expect((await submit({ p_reporter_email: "ada" })).error).not.toBeNull();
  });

  it("is decided by platform admins only, once, with a reason", async () => {
    const id = must(await submit()) as string;
    expect((await rpc("takedown_decide", { p_actor: member.userId, p_notice_id: id, p_status: "rejected", p_brand_id: null, p_note: "No" })).error).not.toBeNull();
    expect((await asAdmin("takedown_decide", { p_notice_id: id, p_status: "rejected", p_brand_id: null, p_note: " " })).error?.hint).toBe("reason_needed");
    expect((await asAdmin("takedown_decide", { p_notice_id: id, p_status: "maybe", p_brand_id: null, p_note: "No" })).error?.hint).toBe("invalid_input");
    must(await asAdmin("takedown_decide", { p_notice_id: id, p_status: "rejected", p_brand_id: null, p_note: "Not a mark we can act on" }));
    expect((await asAdmin("takedown_decide", { p_notice_id: id, p_status: "upheld", p_brand_id: brand, p_note: "Again" })).error?.hint).toBe("invalid_transition");
  });

  it("names a brand to be upheld, and that brand must exist", async () => {
    const id = must(await submit()) as string;
    expect((await asAdmin("takedown_decide", { p_notice_id: id, p_status: "upheld", p_brand_id: null, p_note: "Theirs" })).error?.hint).toBe("invalid_input");
    expect((await asAdmin("takedown_decide", { p_notice_id: id, p_status: "upheld", p_brand_id: randomUUID(), p_note: "Theirs" })).error?.hint).toBe("invalid_input");
  });

  it("counts a brand's upheld notices, one strike at a time, and a rejection counts for nothing", async () => {
    const infringer = await person("mod-infringer");
    const infringerBrand = await brandOf(infringer, "Repeat FC");
    const uphold = async (): Promise<number> => {
      const id = must(await submit()) as string;
      return must(await asAdmin("takedown_decide", { p_notice_id: id, p_status: "upheld", p_brand_id: infringerBrand, p_note: "Theirs" })) as number;
    };
    expect([await uphold(), await uphold(), await uphold()]).toEqual([1, 2, 3]);
    const rejected = must(await submit()) as string;
    expect(must(await asAdmin("takedown_decide", { p_notice_id: rejected, p_status: "rejected", p_brand_id: null, p_note: "No" }))).toBeNull();
    expect(await uphold()).toBe(4);
  });
});

/**
 * The grants stop every role a browser or the server can use, which the tests above show. The trigger stops the owner of the
 * table too, and only a connection as the owner can show that. It runs psql inside the local database container, like
 * `append-only-owner.test.ts`, and is skipped where Docker is not reachable.
 */
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";

const psql = (sql: string): Readonly<{ ok: boolean; output: string }> => {
  try {
    const output = execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000,
    });
    return { ok: true, output };
  } catch (error) {
    const failure = error as { stderr?: string; message: string };
    return { ok: false, output: failure.stderr ?? failure.message };
  }
};

const dockerReachable = psql("select 1").ok;
if (!dockerReachable) {
  console.warn(`Skipping the owner-level moderation tests: cannot reach the database container "${CONTAINER}" through Docker.`);
}

const REFUSED = /can never be changed or removed/;

describe.skipIf(!dockerReachable)("a result, as seen by the owner of the table", () => {
  const decided = async (): Promise<string> => {
    const id = await recorded();
    must(await asAdmin("moderation_review", { p_check_id: id, p_decision: "allowed", p_reason: "Their own club crest" }));
    return id;
  };

  it("refuses a change to the screening itself, and a delete while the brand exists", async () => {
    const id = await recorded();
    for (const sql of [`update public.moderation_checks set result = 'clear' where id = '${id}'`, `delete from public.moderation_checks where id = '${id}'`]) {
      const result = psql(`begin; ${sql}; rollback;`);
      expect(result.ok, sql).toBe(false);
      expect(result.output, sql).toMatch(REFUSED);
    }
    expect(must(await adminClient().from("moderation_checks").select("result").eq("id", id).single())).toMatchObject({ result: "flagged" });
  });

  it("refuses to unmake or rewrite a decision once it has been made", async () => {
    const id = await decided();
    const changes = ["decision = 'blocked'", "decision_reason = 'Another reason'", "decision = null, decision_reason = null, reviewed_at = null"];
    for (const change of changes) {
      const result = psql(`begin; update public.moderation_checks set ${change} where id = '${id}'; rollback;`);
      expect(result.ok, change).toBe(false);
      expect(result.output, change).toMatch(REFUSED);
    }
  });

  it("lets a deleted account's id be cleared, which is how the foreign keys take it out", async () => {
    const id = await decided();
    const result = psql(
      `begin; update public.moderation_checks set created_by = null, reviewer = null where id = '${id}';` +
        ` select decision from public.moderation_checks where id = '${id}'; rollback;`,
    );
    expect(result.ok, result.output).toBe(true);
    expect(result.output).toMatch(/^allowed$/m);
  });

  it("refuses to make a row name somebody else", async () => {
    const id = await recorded();
    const result = psql(`begin; update public.moderation_checks set created_by = '${admin.userId}' where id = '${id}'; rollback;`);
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(REFUSED);
  });

  it("refuses to empty the table", async () => {
    const result = psql("begin; truncate public.moderation_checks cascade; rollback;");
    expect(result.ok).toBe(false);
    expect(result.output).toMatch(REFUSED);
  });
});

describe("who may read any of it", () => {
  const submit = () =>
    rpc("takedown_submit", {
      p_reporter_name: "Ada", p_reporter_email: "ada@example.com", p_holder: "H", p_mark: "M", p_location: "A product", p_details: "",
    });

  it("is platform admins only: a member and the owner of the brand see nothing", async () => {
    await recorded();
    must(await submit());
    for (const who of [owner, member]) {
      for (const table of ["moderation_checks", "rights_holder_marks", "takedown_notices"]) {
        expect(must(await who.client.from(table).select("id")), `${table} as ${who.email}`).toEqual([]);
      }
    }
    for (const table of ["moderation_checks", "rights_holder_marks", "takedown_notices"]) {
      expect((must(await admin.client.from(table).select("id")) as unknown[]).length, table).toBeGreaterThan(0);
    }
  });
});
