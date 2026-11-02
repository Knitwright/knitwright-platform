import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Two workstreams cannot share a migration timestamp.
 *
 * `plans/platform-v5.md` assigns a timestamp per workstream, but it only assigns the migrations it
 * foresaw; a workstream needing one that is not listed is told to take "the wave's date with the next
 * free hour". Several did, in parallel, without being able to see each other — and L2 and L4 both chose
 * `20261201060000`. Each branch was correct alone and green alone. Applying both failed with
 * `duplicate key value violates unique constraint "schema_migrations_pkey"`, which surfaced only
 * after one had merged, as a CI failure on the other that looks nothing like its cause.
 *
 * This fails locally, in a second, on the branch that picked a taken hour.
 */

const MIGRATIONS = fileURLToPath(new URL("../../../../supabase/migrations/", import.meta.url));

/** Every migration as { stamp, file }, in the order Postgres will apply them. */
const migrations = (): readonly { stamp: string; file: string }[] =>
  readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ stamp: file.slice(0, 14), file }));

describe("the migration files", () => {
  it("each begin with a 14-digit timestamp", () => {
    for (const { file, stamp } of migrations()) {
      expect(stamp, `${file} does not begin with a 14-digit timestamp`).toMatch(/^\d{14}$/);
    }
  });

  it("never share a timestamp, because the database keys its applied list by it", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const { stamp, file } of migrations()) {
      const first = seen.get(stamp);
      if (first === undefined) seen.set(stamp, file);
      else clashes.push(`${stamp}: ${first} and ${file}`);
    }
    // The message has to name both files: the branch that reads this failure is usually not the
    // branch that wrote the other one.
    expect(clashes, `two migrations share a timestamp. Move the later one to the next free hour and rename every reference to it:\n  ${clashes.join("\n  ")}`).toStrictEqual([]);
  });

  it("names each migration once, whatever its timestamp", () => {
    const names = migrations().map(({ file }) => file.slice(15));
    expect(names, "two migrations have the same name after their timestamp, which makes a reference to either ambiguous").toStrictEqual([...new Set(names)]);
  });
});
