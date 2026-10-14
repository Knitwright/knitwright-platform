import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeClient } from "./fixtures/fake-client";
import { emptyBrandFolders } from "./storage";

const MIGRATIONS = join(__dirname, "..", "..", "..", "..", "supabase", "migrations");
const SQL = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort().map((name) => readFileSync(join(MIGRATIONS, name), "utf8")).join("\n");

interface TableText { readonly name: string; readonly body: string }

const tables = (): TableText[] =>
  [...SQL.matchAll(/create table (?:if not exists )?public\.(\w+) \(([\s\S]*?)\n\);/g)].map((match) => ({ name: match[1], body: match[2] }));

const KEEPS_PEOPLE = /references auth\.users \(id\)\s+on delete restrict/;
const GOES_WITH_BRAND =
  /brand_id uuid[^\n]*references public\.brands \(id\) on delete cascade|foreign key \(\w+, brand_id\) references public\.\w+ \(id, brand_id\)\s+on delete cascade/;

/**
 * Deleting an account removes its brands first and the sign-in record last. A column that points at the sign-in
 * record with `on delete restrict` would stop that last step, unless its row has already gone with the brand.
 */
describe("rows that name a person", () => {
  const naming = tables().filter(({ body }) => KEEPS_PEOPLE.test(body));

  it("are found, including the artwork, import, print profile and league rule tables", () => {
    const names = naming.map(({ name }) => name);
    for (const expected of ["user_artworks", "design_imports", "print_profiles", "league_rule_sets"]) expect(names).toContain(expected);
  });

  it.each(naming.filter(({ name }) => name !== "brands").map(({ name, body }) => [name, body] as const))("%s goes with its brand", (_name, body) => {
    expect(body).toMatch(GOES_WITH_BRAND);
  });
});

describe("a brand's artwork files", () => {
  const BRAND = "0b5c7f0e-8a53-4a6f-9d3e-2f7f1c1f0a11";

  it("are removed with the brand: the screen copy, the print copy and the vector model", async () => {
    const fake = fakeClient({
      objects: {
        uploads: [`${BRAND}/artwork/screen.png`],
        exports: [`${BRAND}/artwork-print/print.tiff`, `${BRAND}/artwork-vector/model.json`],
      },
    });
    expect(await emptyBrandFolders(fake.client, [BRAND])).toBe(3);
    expect(fake.objects("uploads")).toEqual([]);
    expect(fake.objects("exports")).toEqual([]);
  });
});
