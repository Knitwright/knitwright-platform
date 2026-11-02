import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_KINDS, GENERATED_KINDS } from "@/lib/launch";
import { assetsOf, FLOW_TEMPLATES } from "./templates";
import { FLOW_FORMATS, GENERATIONS } from "./types";

/**
 * The six packs are written down twice on purpose: once in `lib/flows/templates/**`, where a test
 * can ask L1's own board table whether each one could be wired by hand, and once as rows, because
 * the plan's own rule is that a template is data and not a constant. This is the test that pays for
 * the second copy: a pack, a step, a connector or a count changed on one side fails here before the
 * two can disagree.
 */

const MIGRATION = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261201030000_flow_runs.sql");
const sql = readFileSync(MIGRATION, "utf8");

/** Where the statement starting at `from` ends: the first `;` that is not inside a quoted word. */
function endOfStatement(from: number): number {
  let inQuote = false;
  for (let at = from; at < sql.length; at += 1) {
    const char = sql[at];
    if (char === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (char === ";" && !inQuote) return at;
  }
  return sql.length;
}

/** The text between `insert into <table> (...) values` and the `;` that ends that statement. */
function valuesBlock(table: string): string {
  const at = sql.indexOf(`insert into public.${table} (`);
  if (at < 0) throw new Error(`No insert into ${table}`);
  const from = sql.indexOf(" values", at) + " values".length;
  return sql.slice(from, endOfStatement(from));
}

/**
 * The tuples of a VALUES block, each as a list of fields. Written as a pass over the characters
 * rather than a regular expression because a seeded sentence holds commas, brackets and doubled
 * quotes, and a regular expression that coped with all three would be the least readable thing here.
 */
function tuples(block: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuote = false;
  let depth = 0;
  for (let at = 0; at < block.length; at += 1) {
    const char = block[at] as string;
    if (inQuote) {
      if (char === "'" && block[at + 1] === "'") {
        field += "'";
        at += 1;
      } else if (char === "'") inQuote = false;
      else field += char;
      continue;
    }
    if (char === "'") {
      inQuote = true;
      continue;
    }
    if (char === "(" || char === "[") {
      depth += 1;
      if (depth === 1) {
        fields = [];
        field = "";
        continue;
      }
    }
    if (char === ")" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        fields.push(field.trim());
        rows.push(fields);
        continue;
      }
    }
    if (char === "," && depth === 1) {
      fields.push(field.trim());
      field = "";
      continue;
    }
    if (depth >= 1) field += char;
  }
  return rows;
}

const TEMPLATE_ROWS = tuples(valuesBlock("flow_templates"));
const STEP_ROWS = tuples(valuesBlock("flow_template_steps"));
const LINK_ROWS = tuples(valuesBlock("flow_template_links"));

/** `array['a', 'b']` as read by the parser above: the quotes are gone and the words are left. */
const arrayFields = (value: string): readonly string[] =>
  value
    .replace(/^array\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one.length > 0);

describe("the flow templates in the database and the flow templates in TypeScript", () => {
  it("seed the same six packs, in the same order", () => {
    expect(TEMPLATE_ROWS.map((row) => row[0])).toEqual(FLOW_TEMPLATES.map((spec) => spec.slug));
    expect(TEMPLATE_ROWS.map((row) => Number(row[11]))).toEqual(FLOW_TEMPLATES.map((spec) => spec.sort));
  });

  it("agree on every pack's title, lead, sections and asset count", () => {
    for (const [at, spec] of FLOW_TEMPLATES.entries()) {
      const row = TEMPLATE_ROWS[at] as readonly string[];
      expect(row[1], spec.slug).toBe(spec.title);
      expect(row[2], spec.slug).toBe(spec.lead);
      expect(arrayFields(row[3] as string), spec.slug).toEqual([...spec.sections]);
      expect(Number(row[4]), spec.slug).toBe(spec.assets);
    }
  });

  it("agree that nobody has reviewed a pack and that no tutorial film exists", () => {
    for (const [at, spec] of FLOW_TEMPLATES.entries()) {
      const row = TEMPLATE_ROWS[at] as readonly string[];
      expect(row[5], spec.slug).toBe(spec.tutorial.title);
      expect(row[6], spec.slug).toBe(spec.tutorial.body);
      expect(row[7], spec.slug).toBe("null");
      expect(row[8], spec.slug).toBe(spec.tutorial.note);
      expect(row[9], spec.slug).toContain("not reviewed by anyone");
      expect(row[10], spec.slug).toBe(spec.ruleId);
    }
  });

  it("seed every step of every pack, with the same section, kind, settings and format", () => {
    const expected = FLOW_TEMPLATES.flatMap((spec) => spec.steps.map((step) => ({ spec, step })));

    expect(STEP_ROWS).toHaveLength(expected.length);
    for (const [at, { spec, step }] of expected.entries()) {
      const row = STEP_ROWS[at] as readonly string[];
      const where = `${spec.slug}/${step.key}`;
      expect(row[0], where).toBe(spec.slug);
      expect(row[1], where).toBe(step.key);
      expect(row[2], where).toBe(step.section);
      expect(row[3], where).toBe(step.kind);
      expect(row[4], where).toBe(step.name);
      expect(JSON.parse((row[5] as string).replace(/::jsonb$/, "")), where).toEqual(step.settings);
      expect(row[6] === "null" ? null : row[6], where).toBe(step.note);
      expect(row[7], where).toBe(step.generation);
      expect(Number(row[8]), where).toBe(step.assets);
      expect(row[9], where).toBe(step.format);
    }
  });

  it("seed every connector of every pack, numbered the same way", () => {
    const expected = FLOW_TEMPLATES.flatMap((spec) =>
      spec.steps.flatMap((step) => step.feeds.map((from, index) => [spec.slug, from, step.key, String(index + 1)])),
    );

    expect(LINK_ROWS.map((row) => [...row])).toEqual(expected);
  });

  it("seed a set of steps whose assets add up to the count 07 gives the pack", () => {
    for (const spec of FLOW_TEMPLATES) {
      const rows = STEP_ROWS.filter((row) => row[0] === spec.slug);
      expect(rows.reduce((total, row) => total + Number(row[8]), 0), spec.slug).toBe(assetsOf(spec));
    }
  });
});

describe("what the flow tables hold", () => {
  it("names the same board kinds L1's board table names", () => {
    const column = /kind text not null check \(kind in \(([^)]+)\)\)/.exec(sql);
    expect(column).not.toBeNull();
    expect([...column![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1])).toEqual([...BOARD_KINDS]);
  });

  it("names the same two ways a picture is made, and the same four formats", () => {
    const generation = /generation text not null check \(generation in \(([^)]+)\)\)/.exec(sql);
    expect([...generation![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1])).toEqual([...GENERATIONS]);
    const format = /format text not null check \(format in \(([^)]+)\)\)/.exec(sql);
    expect([...format![1]!.matchAll(/'([a-z0-9]+)'/g)].map((found) => found[1])).toEqual([...FLOW_FORMATS]);
  });

  it("asks the whole branch about artwork, and names exactly the kinds a model draws", () => {
    const arm = /where kind in \(([^)]+)\) or settings ->> 'generation' = 'model'/.exec(sql);
    expect(arm).not.toBeNull();
    expect([...arm![1]!.matchAll(/'([a-z_]+)'/g)].map((found) => found[1])).toEqual([...GENERATED_KINDS]);
    expect(sql).toContain("create trigger boards_artwork_never_comes_through_a_generated_board");
  });

  it("gives the server's own key nothing but SELECT on the brand's own flow tables", () => {
    expect(sql).toContain("grant select on public.flow_runs, public.flow_run_boards, public.flow_listings to authenticated, service_role;");
    expect(sql).not.toMatch(/grant [^;]*insert[^;]*on public\.flow_runs/);
    expect(sql).not.toMatch(/grant [^;]*update[^;]*on public\.flow_runs/);
  });

  it("keeps a listing hand-off append-only, and keeps every Store concept out of the file", () => {
    expect(sql).toContain("create trigger flow_listings_append_only");
    // A credit price is not a Store concept: the platform already charges credits, and this file
    // reads that price. What must not be here is anything that sells something.
    for (const word of ["cart", "checkout", "stripe", "payout", "storefront", "retail", "merchant", "shipping"]) {
      expect(sql.toLowerCase().split("\n").filter((line) => !line.trim().startsWith("--")).join("\n"), word).not.toContain(word);
    }
  });

  it("gives back one spend at a time, which is what a failed board needs", () => {
    expect(sql).toContain("create function public.credit_refund_spend(p_brand_id uuid, p_entry_id uuid, p_note text)");
    expect(sql).toContain("'refund:' || s.id");
    expect(sql).toContain("not exists (select 1 from public.credit_ledger r where r.refund_of = s.id)");
  });

  it("fixes the search path of every function it adds, as the isolation suite requires", () => {
    const functions = [...sql.matchAll(/create function ([a-z_.]+)\(/g)].map((found) => found[1]);
    expect(functions.length).toBeGreaterThan(4);
    expect(sql.match(/set search_path = ''/g)?.length).toBe(functions.length);
  });
});
