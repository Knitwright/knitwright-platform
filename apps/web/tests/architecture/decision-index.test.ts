import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `docs/decisions/README.md`'s table is generated from the records by
 * `scripts/write-decision-index.mjs`. It used to be edited by hand, so every workstream added its
 * row to the end of one table and every pair of live branches conflicted on it — and a row was
 * quietly lost that way: decision 0080 was written, merged, and never indexed.
 *
 * This test runs the generator's own `--check`, so a record written without running it fails here
 * instead of leaving the index stale, and a record that cannot be indexed at all (no numbered
 * heading, no status) fails here rather than being skipped in silence.
 */

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SCRIPT = "scripts/write-decision-index.mjs";

describe("the decision index", () => {
  it("matches the records, so nothing written is missing from it", () => {
    // The generator exits non-zero and says what to run when the table is out of date.
    expect(() => execFileSync("node", [SCRIPT, "--check"], { cwd: REPO, encoding: "utf8", stdio: "pipe" })).not.toThrow();
  });

  it("never numbers two records the same", () => {
    // The generator throws on a duplicate, and `--check` above would catch it; this names the fault
    // directly so the failure says what to do. Two workstreams each taking "the next free number"
    // without being able to see the other happened three times in one day: L2 and L4 on a migration
    // hour, O3 and the top bar on 0103, and Z5 and Z7 on 0086 -- the last of which reached `main`
    // and put two rows with the same number in the index before this guard existed.
    const numbers = execFileSync("node", ["-e", `import("./${SCRIPT}").then((m) => process.stdout.write(m.rows().map((r) => r.number).join(",")))`], {
      cwd: REPO,
      encoding: "utf8",
    }).split(",");
    expect(numbers).toStrictEqual([...new Set(numbers)]);
  });

  it("indexes every numbered record but the template", () => {
    const decisions = fileURLToPath(new URL("../../../../docs/decisions/", import.meta.url));
    const records = readdirSync(decisions).filter((file) => /^\d{4}-.*\.md$/.test(file) && !file.startsWith("0000-"));
    const index = execFileSync("node", ["-e", `import("./${SCRIPT}").then((m) => process.stdout.write(String(m.rows().length)))`], {
      cwd: REPO,
      encoding: "utf8",
    });
    expect(Number(index)).toBe(records.length);
  });
});
