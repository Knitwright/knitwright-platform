import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_KINDS, BOARDS, DETERMINISTIC_KINDS, GENERATED_KINDS } from "./index";

/**
 * The board table exists twice on purpose (decision 0091, item 3): once here, where it gives a
 * person a sentence they can read, and once in SQL, where it refuses the row whatever calls it.
 * Two copies of one table is a cost, and this is what pays it: a kind added, renamed or re-wired on
 * one side fails here before it can disagree with the other.
 */

const MIGRATION = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261201010000_launch_projects.sql");
const sql = readFileSync(MIGRATION, "utf8");
/** The one canvas (decision 0145) redefined the kind list, the connector table and the constraint. */
const CANVAS = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261224010000_one_canvas.sql");
const canvasSql = readFileSync(CANVAS, "utf8");

/** The `when '<kind>' then v_from.kind ...` arm of `connect_launch_boards`, as a list of kinds. */
function acceptsInSql(kind: string): readonly string[] {
  const arm = new RegExp(`when '${kind}' then v_from\\.kind (=|in) ([^\\n]+)`).exec(canvasSql);
  if (!arm) return [];
  return [...arm[2]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1] as string);
}

describe("the board table in the database and the board table in TypeScript", () => {
  it("names the same ten kinds in the same order", () => {
    const column = /boards_kind_check\s+check \(kind in \(([^)]+)\)\)/.exec(canvasSql);
    expect(column).not.toBeNull();
    expect([...column![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1])).toEqual([...BOARD_KINDS]);
  });

  it("allows the same inputs for every kind a connector may end at", () => {
    for (const kind of BOARD_KINDS) {
      const theirs = [...acceptsInSql(kind)].sort();
      const ours = [...BOARDS[kind].accepts].sort();
      expect(theirs, `the ${kind} board`).toEqual(ours);
    }
  });

  it("lets nothing feed a design board, a garment board or an artboard, on either side", () => {
    for (const kind of ["design", "garment", "artboard"] as const) {
      expect(acceptsInSql(kind)).toEqual([]);
      expect(BOARDS[kind].accepts).toEqual([]);
    }
  });

  it("names the same deterministic kinds in the constraint that keeps a generated output off a panel", () => {
    const check = /boards_generated_output_is_never_artwork check \(\s*output_role = 'asset' or kind in \(([^)]+)\)/.exec(canvasSql);
    expect(check).not.toBeNull();
    const allowed = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1]);
    expect([...allowed].sort()).toEqual([...DETERMINISTIC_KINDS].sort());
    for (const kind of GENERATED_KINDS) expect(allowed).not.toContain(kind);
  });

  it("checks the garment lock for exactly the kinds a model draws", () => {
    const arm = /if v_board\.kind in \(([^)]+)\) then/.exec(sql);
    expect(arm).not.toBeNull();
    expect([...arm![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1])).toEqual([...GENERATED_KINDS]);
  });

  it("holds the artboard presets to the bounds the inspector holds a typed size to", () => {
    expect(sql).toContain("width integer not null default 1080 check (width between 16 and 20000)");
    expect(sql).toContain("height integer not null default 1080 check (height between 16 and 20000)");
  });
});
