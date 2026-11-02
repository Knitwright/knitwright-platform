import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER, PERSONAL_DATA_TABLES } from "./team-data";

const MIGRATIONS = join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
const read = (name: string): string => readFileSync(join(MIGRATIONS, name), "utf8");
const SQL = `${read("20261015040000_team_orders.sql")}\n${read("20261015040100_releases_and_proofs.sql")}\n${read("20261025040000_club_workspace.sql")}\n${read("20261026040000_ops_qc.sql")}\n${read("20261028040000_design_comments.sql")}\n${read("20261210010000_ops_completion.sql")}\n${read("20261110030000_share_invites.sql")}\n${read("20261120050000_committee_signup.sql")}`;

/** Every migration, for the sweeps that must not depend on a list someone has to remember to add to. */
const EVERY_MIGRATION = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => read(name))
  .join("\n");

/** Each `create table public.<name> (...)` in the given SQL, as a pair of name and body. */
const createdTables = (sql: string): readonly { name: string; body: string }[] =>
  [...sql.matchAll(/create table (?:if not exists )?public\.(\w+) \(([\s\S]*?)\n\);/g)].map((m) => ({
    name: m[1],
    body: m[2],
  }));

const registered = (table: string): boolean => PERSONAL_DATA_TABLES.some((p) => p.table === table);

/** The text of `create table public.<name> (...)` up to its closing line. */
/**
 * Tables the committee migration creates that hold no brand's data at all: the platform's own rule
 * rows, the same for every club. They are not personal data and have no brand to go with.
 */
const PLATFORM_RULE_TABLES = ["chase_templates", "public_link_windows", "shirt_zone_limits", "sport_number_rules"];

const tableBody = (name: string): string => {
  const start = SQL.indexOf(`create table public.${name} (`);
  expect(start, `${name} is created`).toBeGreaterThanOrEqual(0);
  return SQL.slice(start, SQL.indexOf("\n);", start));
};

describe("what holds people's names for production", () => {
  it.each(PERSONAL_DATA_TABLES.map((t) => t.table))("%s goes with its design or its order", (table) => {
    const body = tableBody(table);
    // A public link is the second hop: the records a stranger leaves hang off the link, and the link
    // hangs off the design or the season. The test below checks that second hop on its own.
    const viaDesignOrOrder = /foreign key \((project_id|order_id|season_id|link_id), brand_id\) references public\.(projects|team_orders|production_releases|club_seasons|committee_links|roster_signup_links) \(id, brand_id\)\s+on delete cascade/;
    const viaBrand = /brand_id uuid (not null )?(primary key )?references public\.brands \(id\) on delete cascade/;
    expect(viaDesignOrOrder.test(body) || viaBrand.test(body)).toBe(true);
  });

  it("the public links the committee and sign-up records hang off go with their design or season", () => {
    // Without this, the test above would accept a record whose link outlived the design.
    expect(tableBody("committee_links")).toMatch(
      /foreign key \(project_id, brand_id\) references public\.projects \(id, brand_id\) on delete cascade/,
    );
    expect(tableBody("roster_signup_links")).toMatch(
      /foreign key \(season_id, brand_id\) references public\.club_seasons \(id, brand_id\) on delete cascade/,
    );
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

  // The sweeps above each name one migration, so a table added by a migration nobody listed was
  // invisible to this file. That is how Z7's nine committee and sign-up tables, two of which hold an
  // email address, came to be unregistered (security-v5, H1). These two read every migration there is.
  it("every table in every migration that holds an email address or a phone number is registered, or exempt with a reason", () => {
    const address = /^\s*((?:\w+_)?(?:email|phone)(?:_\w+)?) (?:text|citext|varchar)/m;
    const holders = createdTables(EVERY_MIGRATION)
      .filter((t) => address.test(t.body))
      .map((t) => t.name);

    expect(holders.length).toBeGreaterThan(0);
    expect(
      holders
        .filter((t) => !registered(t) && !ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER.some((e) => e.table === t))
        .sort(),
    ).toEqual([]);
    for (const { table, why } of ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER) {
      expect(holders, `${table} still holds an address`).toContain(table);
      expect(registered(table)).toBe(false);
      expect(why.length).toBeGreaterThan(40);
    }
  });

  it("every brand's own table the committee and sign-up migration creates is registered", () => {
    const signup = read("20261120050000_committee_signup.sql");
    const brandOwn = createdTables(signup)
      .filter((t) => /^\s*brand_id uuid not null/m.test(t.body))
      .map((t) => t.name);

    expect(brandOwn).toHaveLength(9);
    expect(brandOwn.filter((t) => !registered(t))).toEqual([]);
  });

  it("every table the comments migration creates is listed here, and deleting a design deletes its comments", () => {
    const comments = read("20261028040000_design_comments.sql");
    const created = [...comments.matchAll(/create table public\.(\w+) \(/g)].map((m) => m[1]).sort();
    expect(created.filter((t) => !PERSONAL_DATA_TABLES.some((p) => p.table === t))).toEqual([]);
    expect(comments).toMatch(/foreign key \(project_id, brand_id\) references public\.projects \(id, brand_id\) on delete cascade/);
    expect(comments).toMatch(/foreign key \(comment_id, brand_id\) references public\.design_comments \(id, brand_id\) on delete cascade/);
  });

  it("the platform's rule rows hold nobody's personal data, so they are not on the list", () => {
    for (const table of PLATFORM_RULE_TABLES) {
      expect(PERSONAL_DATA_TABLES.some((p) => p.table === table), `${table} is a rule table`).toBe(false);
    }
  });
});
