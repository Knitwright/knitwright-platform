import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildMarketingTemplates, marketingRowOf, snapshotOf } from "./build";
import { seedMarketingTemplates } from "./seed";

type Row = Readonly<{ slug: string }>;

/** A service client that answers with the rows given and keeps what it was asked to write. */
function fakeAdmin(reviewed: readonly Row[] = [], readError: { message: string } | null = null, writeError: { message: string } | null = null) {
  const written: unknown[][] = [];
  const filters: { column: string; value: unknown }[] = [];
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => (filters.push({ column, value }), query),
    then: undefined,
    upsert: async (rows: unknown[]) => (written.push(rows), { error: writeError }),
  };
  // The read is awaited after two `eq` calls, so the object itself resolves.
  const readable = Object.assign(query, {
    then: (resolve: (value: { data: readonly Row[]; error: unknown }) => unknown) => resolve({ data: reviewed, error: readError }),
  });
  return { admin: { from: () => readable } as unknown as SupabaseClient, written, filters };
}

describe("seeding the marketing templates", () => {
  it("writes all 50 rows, found by slug, so running it again changes nothing else", async () => {
    const { admin, written } = fakeAdmin();
    expect(await seedMarketingTemplates(admin)).toBe(50);
    expect(written).toHaveLength(1);
    expect(written[0]).toHaveLength(50);
  });

  it("asks only for the marketing rows a platform admin has reviewed, and leaves those alone", async () => {
    const first = buildMarketingTemplates()[0]!;
    const { admin, written, filters } = fakeAdmin([{ slug: first.slug }]);

    expect(await seedMarketingTemplates(admin)).toBe(49);
    expect(filters).toEqual([
      { column: "kind", value: "marketing" },
      { column: "review_state", value: "reviewed" },
    ]);
    expect((written[0] as { slug: string }[]).some((row) => row.slug === first.slug)).toBe(false);
  });

  it("writes nothing when every row is reviewed", async () => {
    const all = buildMarketingTemplates().map((row) => ({ slug: row.slug }));
    const { admin, written } = fakeAdmin(all);

    expect(await seedMarketingTemplates(admin)).toBe(0);
    expect(written).toEqual([]);
  });

  it("says plainly when the read or the write failed", async () => {
    await expect(seedMarketingTemplates(fakeAdmin([], { message: "no read" }).admin)).rejects.toThrow("no read");
    await expect(seedMarketingTemplates(fakeAdmin([], null, { message: "no write" }).admin)).rejects.toThrow("no write");
  });
});

describe("the row a marketing template becomes", () => {
  const row = marketingRowOf(buildMarketingTemplates()[0]!);

  it("is of kind marketing, and leaves every column that describes a design empty", () => {
    expect(row.kind).toBe("marketing");
    expect([row.sport, row.article_id, row.wearer, row.style_tags, row.colour_family]).toEqual([null, null, null, null, null]);
  });

  it("is the platform's own, and says nobody has reviewed it", () => {
    expect(row.source).toBe("knitwright");
    expect(row.review_state).toBe("not_reviewed");
    expect(row.snapshot.label).toContain("not reviewed by anyone");
  });

  it("keeps the layout in the snapshot, with its format and every slot", () => {
    const template = buildMarketingTemplates()[0]!;
    expect(row.snapshot).toEqual(snapshotOf(template));
    expect(row.snapshot.kind).toBe("marketing");
    expect(row.snapshot.format).toBe(template.format);
    expect(row.snapshot.slots).toHaveLength(template.slots.length);
  });

  it("gives every row a slug and a title the table's own checks accept", () => {
    for (const template of buildMarketingTemplates()) {
      const built = marketingRowOf(template);
      expect(built.slug, built.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(built.slug.length).toBeLessThanOrEqual(64);
      expect(built.title.trim()).toBe(built.title);
      expect(built.title.length).toBeLessThanOrEqual(120);
      expect(JSON.stringify(built.snapshot).length).toBeLessThan(262144);
    }
  });

  it("is the same every time it is built, so the seed is deterministic", () => {
    expect(buildMarketingTemplates().map(marketingRowOf)).toEqual(buildMarketingTemplates().map(marketingRowOf));
  });
});
