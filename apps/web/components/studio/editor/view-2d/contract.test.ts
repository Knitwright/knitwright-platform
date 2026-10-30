import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Y3's two panels against the slot contract (`lib/editor/slots.ts`, decision 0075) and against the
 * rules of plan v5 that the code itself can prove (decision 0076).
 *
 * A slot is a default export taking `EditorSlotProps` and nothing else, it never fetches, and every
 * change it makes goes back through `commands`. A source test is the right test here: the panels are
 * drawn in a browser, the suite runs in Node, and what is being checked is the shape of the seam.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const MINE = ["components/studio/editor/view-2d", "components/studio/editor/library", "lib/panel-layers"];

const SLOTS: readonly (readonly [string, string])[] = [
  ["components/studio/editor/view-2d/PatternView.tsx", "PatternView"],
  ["components/studio/editor/library/LibraryToolbar.tsx", "LibraryToolbar"],
];

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const sources = (folder: string): string[] =>
  readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

const mine = (): string[] => MINE.flatMap(sources);

describe("the slot contract", () => {
  it("is a default export taking EditorSlotProps and nothing else", () => {
    for (const [path, name] of SLOTS) {
      const text = read(path);
      expect(text, path).toMatch(new RegExp(`export default function ${name}\\(\\{ design, commands \\}: EditorSlotProps\\)`));
    }
  });

  it("reads the contract from the shell's own file, so a change there fails here", () => {
    for (const [path] of SLOTS) expect(read(path), path).toMatch(/from "@\/lib\/editor\/slots"/);
  });
});

describe("a slot never fetches and never writes on its own", () => {
  it("calls no server action, no fetch and nothing under lib/server", () => {
    const offenders = mine().filter((path) => {
      const text = read(path);
      return /\bfetch\(/.test(text) || /from "@\/lib\/server/.test(text) || /Action\(\{/.test(text) || /from "@\/lib\/[a-z-]+\/actions"/.test(text);
    });
    // `lib/panel-layers/actions.ts` is the prototype's own server action (decision 0053); it is a
    // server module, not a slot panel, and no panel of this workstream imports it.
    expect(offenders.filter((path) => path !== "lib/panel-layers/actions.ts")).toEqual([]);
  });

  it("asks the shell to save, rather than storing anything itself", () => {
    const writers = mine().filter((path) => /commands\.save\(|commands\.setOption\(/.test(read(path)));
    expect(writers.length).toBeGreaterThan(0);
    expect(mine().filter((path) => /append_spec_version|supabase/i.test(read(path))).filter((path) => path !== "lib/panel-layers/actions.ts")).toEqual([]);
  });
});

describe("the panels stay inside this workstream's own directories", () => {
  it("import no other workstream's editor panel", () => {
    const strays = mine().filter((path) => /from "[^"]*editor\/(specs|techpack-view|export|names-numbers|repeat-maker)\//.test(read(path)));
    expect(strays).toEqual([]);
  });
});

describe("AI output never becomes pixels on a panel", () => {
  it("gives the background remover no way to hand back an image, only a stored asset's id", () => {
    const text = read("lib/panel-layers/background.ts");
    expect(text).toMatch(/assetId: string/);
    expect(text).not.toMatch(/dataUrl|base64|imageUrl|readonly url|Buffer|Uint8Array/);
  });

  it("has only the stand-in, which makes no call at all", () => {
    const providers = sources("lib/panel-layers").filter((path) => /BackgroundRemovalProvider =/.test(read(path)));
    expect(providers).toEqual(["lib/panel-layers/background.ts"]);
    expect(read("lib/panel-layers/background.ts")).not.toMatch(/https?:\/\/|process\.env/);
  });
});
