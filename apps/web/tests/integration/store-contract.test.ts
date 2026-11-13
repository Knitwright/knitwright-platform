import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The tables the Store contract used to read, against the real database (plan v5 O2, decision 0106).
 *
 * The contract's endpoints are retired (decision 0157): the platform sells through its own storefronts
 * and team stores now (decisions 0153, 0154). The database half of what it proved still matters and is
 * kept: these tables are under row security, a member sees only their own brand's rows, a visitor with
 * no session sees nothing, and the rows the factory's figures come from are not reachable from a browser
 * at all. It also reads back the facts the storefront relies on (no AUD tier figure, no delivery date).
 *
 * Every test here reads. Nothing is inserted into a table the service role holds only SELECT on, so
 * running this suite leaves the shared database as it found it.
 */

/** The brand-scoped tables the five endpoints read. A member may read their own brand's rows. */
const BRAND_TABLES = ["brand_products", "collection_drops", "flow_listings", "club_kits", "club_seasons", "roster_signup_links"] as const;

/** Catalogue data every signed-in member may read. */
const MEMBER_READABLE = [...BRAND_TABLES, "base_articles", "article_poms", "country_rules"] as const;

/** Rows a browser may not touch at all: the factory's figures and the personalisation limits. */
const SERVER_ONLY = ["price_tiers", "shirt_zone_limits", "sport_number_rules", "platform_settings"] as const;

type Report = Readonly<{ tables: { name: string; rls_enabled: boolean; client_privileges: string[] }[] }>;

let report: Report;
let ann: Person;
let annBrand: string;

beforeAll(async () => {
  report = must(await adminClient().rpc("security_report")) as Report;
  ann = await person("store-contract-ann");
  annBrand = await brandOf(ann, "Store Contract Rangers");
});

const tableIn = (name: string) => report.tables.find((table) => table.name === name);

describe("the tables the Store contract reads", () => {
  it("all exist, with row level security on", () => {
    for (const name of [...MEMBER_READABLE, ...SERVER_ONLY]) {
      expect(tableIn(name)?.rls_enabled, name).toBe(true);
    }
  });

  it("let a browser read, and never write, the ones a member may see", () => {
    for (const name of MEMBER_READABLE) {
      expect(tableIn(name)?.client_privileges, name).toEqual(["SELECT"]);
    }
  });

  it("let a browser do nothing at all to the rows the prices and the limits come from", () => {
    for (const name of SERVER_ONLY) {
      expect(tableIn(name)?.client_privileges, name).toEqual([]);
    }
  });

  it("show a visitor with no session nothing at all", async () => {
    for (const name of BRAND_TABLES) {
      const { data, error } = await anonClient().from(name).select("*").limit(1);
      expect(error !== null || data?.length === 0, name).toBe(true);
    }
  });

  it("show a member no row of another brand, which is what makes these endpoints server-only", async () => {
    for (const name of BRAND_TABLES) {
      const rows = must(await ann.client.from(name).select("brand_id")) as unknown as { brand_id: string }[];
      expect(
        rows.every((row) => row.brand_id === annBrand),
        `${name}: a member read a row of another brand`,
      ).toBe(true);
    }
  });

  it("show a fresh brand none of the hand-offs any other brand has written", async () => {
    for (const name of ["collection_drops", "flow_listings"] as const) {
      expect(must(await ann.client.from(name).select("id")), name).toEqual([]);
    }
  });

  it("answer the server's own key for every one of them, which is how the endpoints read", async () => {
    for (const name of [...MEMBER_READABLE, ...SERVER_ONLY]) {
      const { error } = await adminClient().from(name).select("*").limit(1);
      expect(error, name).toBeNull();
    }
  });
});

describe("the rows the personalisation rules are read from", () => {
  it("are on file, each carrying the rule that explains it and a note saying where it came from", async () => {
    const zones = must(await adminClient().from("shirt_zone_limits").select("zone, max_characters, rule_id, note")) as unknown as Record<string, unknown>[];
    const numbers = must(await adminClient().from("sport_number_rules").select("sport, lowest, highest, rule_id, note")) as unknown as Record<string, unknown>[];

    expect(zones.length).toBeGreaterThan(0);
    expect(numbers.some((row) => row.sport === "default")).toBe(true);
    for (const row of [...zones, ...numbers]) {
      expect(String(row.rule_id)).toMatch(/^R-[A-Z]+-\d{3}$/);
      expect(String(row.note).length).toBeGreaterThan(0);
    }
  });
});

describe("the three things the contract has to keep saying", () => {
  it("has no Australian figure on any tier, so the Australian side of every band is a gap", async () => {
    const tiers = must(await adminClient().from("price_tiers").select("sell_gbp_minor, sell_aud_minor")) as unknown as Record<string, unknown>[];

    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.every((tier) => tier.sell_aud_minor === null)).toBe(true);
  });

  it("has no QC window and no freight figure for a market selling is on for, so no delivery date exists", async () => {
    const rules = must(await adminClient().from("country_rules").select("country, freight_days, selling_enabled")) as unknown as Record<string, unknown>[];
    const qc = must(await adminClient().from("platform_settings").select("key, value").eq("key", "production.qc_days")) as unknown as unknown[];

    expect(rules.length).toBeGreaterThan(0);
    expect(rules.filter((rule) => rule.selling_enabled === true).every((rule) => rule.freight_days === null)).toBe(true);
    expect(qc).toEqual([]);
  });

  it("publishes a point of measure for one base article only, so seven size charts are a gap", async () => {
    const articles = must(await adminClient().from("base_articles").select("id, code")) as unknown as { id: string; code: string }[];
    const poms = must(await adminClient().from("article_poms").select("article_id")) as unknown as { article_id: string }[];

    expect(articles).toHaveLength(8);
    expect(new Set(poms.map((pom) => pom.article_id)).size).toBe(1);
  });
});
