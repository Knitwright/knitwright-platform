import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERSONAL_DATA_TABLES } from "./team-data";

const MIGRATIONS = join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
const read = (name: string): string => readFileSync(join(MIGRATIONS, name), "utf8");
const SQL = `${read("20261015040000_team_orders.sql")}\n${read("20261015040100_releases_and_proofs.sql")}\n${read("20261025040000_club_workspace.sql")}\n${read("20261026040000_ops_qc.sql")}\n${read("20261028040000_design_comments.sql")}`;

/** The text of `create table public.<name> (...)` up to its closing line. */
const tableBody = (name: string): string => {
  const start = SQL.indexOf(`create table public.${name} (`);
  expect(start, `${name} is created`).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf("\n);", start));
};

describe("what holds people's names for production", () => {
  it.each(PERSONAL_DATA_TABLES.map((t) => t.table))("%s goes with its design or its order", (table) => {
    const body = tableBody(table);
    const viaDesignOrOrder = /foreign key \((project_id|order_id|season_id), brand_id\) references public\.(projects|team_orders|production_releases|club_seasons) \(id, brand_id\)\s+on delete cascade/;
    const viaBrand = /brand_id uuid (not null )?(primary key )?references public\.brands \(id\) on delete cascade/;
    expect(viaDesignOrOrder.test(body) || viaBrand.test(body)).toBe(true);
  });

  it("every one has row level security on and no write policy or write grant for browsers", () => {
    for (const { table } of PERSONAL_DATA_TABLES) {
      expect(SQL).toContain(`alter table public.${table} enable row level security;`);
      expect(SQL).not.toMatch(new RegExp(`create policy[^;]*on public\\.${table} for (insert|update|delete|all)`));
    }
    expect(SQL).not.toMatch(/grant (insert|update)[^;]* to (authenticated|anon)/);
  });

  it("the proof photos are removed with their design", () => {
    expect(SQL).toMatch(/f\.kind = 'proof'[\s\S]*unnest\(s\.photo_file_ids\)/);
  });

  it("a team list can be erased on its own by the server, and nothing else here can", () => {
    expect(SQL).toContain("grant delete on public.team_orders to service_role;");
    expect(PERSONAL_DATA_TABLES.filter((t) => t.erasableAlone).map((t) => t.table)).toEqual([
      "team_orders", "team_order_rows", "roster_players", "club_seasons", "club_invitations",
    ]);
  });

  it("a club's roster players, seasons and invitations are erased by functions the server alone may run", () => {
    for (const fn of ["erase_roster_player", "delete_club_season", "cancel_invitation"]) {
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`));
      expect(SQL).not.toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to[^;]*authenticated`));
    }
  });

  it("every table the ops QC migration creates is listed here and is removed with its brand, even the append-only ones", () => {
    const ops = read("20261026040000_ops_qc.sql");
    const created = [...ops.matchAll(/create table public\.(\w+) \(/g)].map((m) => m[1]).sort();
    expect(created.filter((t) => !PERSONAL_DATA_TABLES.some((p) => p.table === t))).toEqual([]);
    expect(ops).toMatch(/not exists \(select 1 from public\.brands b where b\.id = old\.brand_id\)/);
  });

  it("every table the club migration creates is listed here, so a new one cannot hold names unnoticed", () => {
    const club = read("20261025040000_club_workspace.sql");
    const created = [...club.matchAll(/create table public\.(\w+) \(/g)].map((m) => m[1]).sort();
    expect(created.filter((t) => !PERSONAL_DATA_TABLES.some((p) => p.table === t))).toEqual([]);
  });

  it("every table the comments migration creates is listed here, and deleting a design deletes its comments", () => {
    const comments = read("20261028040000_design_comments.sql");
    const created = [...comments.matchAll(/create table public\.(\w+) \(/g)].map((m) => m[1]).sort();
    expect(created.filter((t) => !PERSONAL_DATA_TABLES.some((p) => p.table === t))).toEqual([]);
    expect(comments).toMatch(/foreign key \(project_id, brand_id\) references public\.projects \(id, brand_id\) on delete cascade/);
    expect(comments).toMatch(/foreign key \(comment_id, brand_id\) references public\.design_comments \(id, brand_id\) on delete cascade/);
  });
});
