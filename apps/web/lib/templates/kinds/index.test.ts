import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KINDS_SEEDED_HERE, LAUNCH_COUNTS, TEMPLATE_KINDS, TEMPLATE_KIND_LABELS, isTemplateKind } from ".";

/** The repository root, from apps/web/lib/templates/kinds. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const spec = (): string => readFileSync(join(REPO_ROOT, "docs", "spec", "07-template-library.md"), "utf8");
const migration = (): string => readFileSync(join(REPO_ROOT, "supabase", "migrations", "20261201050000_template_kinds.sql"), "utf8");

/** The row of `07`'s "Template types" table whose name holds `name`, as its cells. */
function typeRow(name: string): string[] {
  const line = spec()
    .split("\n")
    .find((row) => row.startsWith("| **") && row.toLowerCase().includes(name.toLowerCase()));
  expect(line, `no row of 07 names ${name}`).toBeDefined();
  return line!.split("|").map((cell) => cell.trim());
}

describe("the seven kinds of template", () => {
  it("are the seven types of 07, and each has words for a screen", () => {
    expect(TEMPLATE_KINDS).toHaveLength(7);
    expect(new Set(TEMPLATE_KINDS).size).toBe(7);
    for (const kind of TEMPLATE_KINDS) expect(TEMPLATE_KIND_LABELS[kind].length).toBeGreaterThan(2);
  });

  it("are the same seven values the migration allows", () => {
    const allowed = /check \(kind in \(([^)]*)\)\)/u.exec(migration());
    expect(allowed).not.toBeNull();
    const values = [...allowed![1]!.matchAll(/'([a-z_]+)'/gu)].map((match) => match[1]);
    expect(values).toEqual([...TEMPLATE_KINDS]);
  });

  it("knows a kind from anything else", () => {
    expect(isTemplateKind("kit_bundle")).toBe(true);
    expect(isTemplateKind("mockup")).toBe(false);
  });
});

describe("the launch counts", () => {
  it("are read from the Launch count column of 07, not written here", () => {
    const wanted: Readonly<Record<string, string>> = {
      design: "Design template",
      kit_bundle: "Kit bundle template",
      mockup_scene: "Mockup scene",
      marketing: "Marketing template",
      video: "Video template",
      flow: "Flow template",
      techpack: "Tech pack template",
    };
    for (const kind of TEMPLATE_KINDS) {
      const cells = typeRow(wanted[kind]!);
      const count = Number.parseInt(cells[cells.length - 2]!, 10);
      expect(count, kind).toBe(LAUNCH_COUNTS[kind]);
    }
  });

  it("covers the three kinds this workstream seeds and no other", () => {
    expect(KINDS_SEEDED_HERE).toEqual(["design", "kit_bundle", "techpack"]);
    for (const kind of KINDS_SEEDED_HERE) expect(TEMPLATE_KINDS).toContain(kind);
  });
});
