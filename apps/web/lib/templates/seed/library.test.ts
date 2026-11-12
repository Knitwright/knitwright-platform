import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { describeLibrarySeed, LIBRARY_SEED_STEPS, seedLibrary, type SeedStep } from "./library";

const ROOT = join(__dirname, "..", "..", "..", "..", "..");
const fakeAdmin = {} as never;

describe("seedLibrary", () => {
  it("seeds the designs before the bundles that name them, then the tech packs and the marketing templates", () => {
    expect(LIBRARY_SEED_STEPS.map((step) => step.name)).toEqual(["templates", "bundles", "techpacks", "marketing"]);
  });

  it("runs every step in order with the one client and gives back each count", async () => {
    const calls: string[] = [];
    const step = (name: SeedStep["name"], n: number): SeedStep => ({
      name,
      run: vi.fn(async (admin) => {
        expect(admin).toBe(fakeAdmin);
        calls.push(name);
        return n;
      }),
    });
    const steps = [step("templates", 3), step("bundles", 2), step("techpacks", 8), step("marketing", 50)];

    expect(await seedLibrary(fakeAdmin, steps)).toEqual({ templates: 3, bundles: 2, techpacks: 8, marketing: 50 });
    expect(calls).toEqual(["templates", "bundles", "techpacks", "marketing"]);
  });

  it("stops at the first step that fails, so no bundle is written for designs that are not there", async () => {
    const later = vi.fn(async () => 1);
    const steps: SeedStep[] = [
      { name: "templates", run: async () => Promise.reject(new Error("templates upsert failed")) },
      { name: "bundles", run: later },
    ];
    await expect(seedLibrary(fakeAdmin, steps)).rejects.toThrow("templates upsert failed");
    expect(later).not.toHaveBeenCalled();
  });
});

describe("describeLibrarySeed", () => {
  it("says what was written, in one line", () => {
    expect(describeLibrarySeed({ templates: 68, bundles: 6, techpacks: 8, marketing: 50 })).toBe(
      "68 starter templates, 6 kit bundles, 8 tech pack templates and 50 marketing templates written.",
    );
  });
});

describe("the one command", () => {
  it("is pnpm --filter web seed:templates, running this directory's run.mts", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "apps", "web", "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["seed:templates"]).toMatch(/^tsx .*lib\/templates\/seed\/run\.mts$/);
  });

  it("runs the whole library and nothing else, and the marketing seed has no script of its own any more", () => {
    const run = readFileSync(join(__dirname, "run.mts"), "utf8");
    expect(run).toContain("seedLibrary(admin)");
    expect(() => readFileSync(join(ROOT, "apps", "web", "lib", "marketing", "templates", "run.mts"))).toThrow();
  });

  it("is named in the hosted runbook, where a deploy will find it", () => {
    expect(readFileSync(join(ROOT, "docs", "runbooks", "supabase-hosted.md"), "utf8")).toContain("pnpm --filter web seed:templates");
  });
});
