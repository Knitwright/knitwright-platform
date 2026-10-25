import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDIT_WINDOW_MINUTES, MAX_COMMENTS_PER_DESIGN, MAX_MENTIONS, MAX_PER_PERSON_PER_10_MINUTES, MAX_REPLIES_PER_THREAD } from "./limits";
import { LIMITS } from "@/lib/server/limits";
import { COMMENT_MAX_LENGTH } from "./text";

const SQL = readFileSync(join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261028040000_design_comments.sql"), "utf8");

describe("the limits the app shows match the ones the database enforces", () => {
  it("edit window", () => {
    expect(SQL.match(new RegExp(`interval '${EDIT_WINDOW_MINUTES} minutes'`, "g"))).toHaveLength(2);
  });
  it("length, mentions, per design, per thread, per person", () => {
    expect(SQL).toContain(`length(body) <= ${COMMENT_MAX_LENGTH}`);
    expect(SQL).toContain(`> ${MAX_MENTIONS} then`);
    expect(SQL).toContain(`>= ${MAX_COMMENTS_PER_DESIGN}`);
    expect(SQL).toContain(`>= ${MAX_REPLIES_PER_THREAD}`);
    expect(SQL).toContain(`>= ${MAX_PER_PERSON_PER_10_MINUTES}`);
  });
  it("the route limit for writing matches the database's per-person limit", () => {
    expect(LIMITS.commentWrite).toMatchObject({ limit: MAX_PER_PERSON_PER_10_MINUTES, windowSeconds: 600 });
  });
});

describe("the grants and policies of the comments migration", () => {
  const tables = ["design_comments", "design_comment_edits", "design_comment_mentions"];

  it("gives browsers read access to members only, and no write grant or policy", () => {
    expect(SQL).toContain(`revoke all on public.${tables.join(", public.")}`);
    expect(SQL).toMatch(/grant select on public\.design_comments, public\.design_comment_edits, public\.design_comment_mentions\s+to authenticated, service_role;/);
    expect(SQL).not.toMatch(/grant (insert|update|delete)/);
    expect(SQL).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/);
    for (const table of tables) expect(SQL).toContain(`alter table public.${table} enable row level security;`);
  });

  it("lets only the server's key run each function", () => {
    for (const fn of ["design_comment_add", "design_comment_edit", "design_comment_delete", "design_comment_resolve"]) {
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s+from public, anon, authenticated;`));
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\)\\s+to service_role;`));
    }
  });

  it("keeps the edit history append-only", () => {
    expect(SQL).toContain("create trigger design_comment_edits_are_append_only");
    expect(SQL).toContain("create trigger design_comment_edits_are_not_truncated");
  });
});
