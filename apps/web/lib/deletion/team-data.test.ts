import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERSONAL_DATA_TABLES } from "./team-data";

const MIGRATIONS = join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
const read = (name: string): string => readFileSync(join(MIGRATIONS, name), "utf8");
const SQL = `${read("20261015040000_team_orders.sql")}\n${read("20261015040100_releases_and_proofs.sql")}`;

/** The text of `create table public.<name> (...)` up to its closing line. */
const tableBody = (name: string): string => {
  const start = SQL.indexOf(`create table public.${name} (`);
  expect(start, `${name} is created`).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf("\n);", start));
};

describe("what holds people's names for production", () => {
  it.each(PERSONAL_DATA_TABLES.map((t) => t.table))("%s goes with its design or its order", (table) => {
    const body = tableBody(table);
    expect(body).toMatch(/foreign key \((project_id|order_id), brand_id\) references public\.(projects|team_orders|production_releases) \(id, brand_id\)\s+on delete cascade/);
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
    expect(PERSONAL_DATA_TABLES.filter((t) => t.erasableAlone).map((t) => t.table)).toEqual(["team_orders", "team_order_rows"]);
  });
});
