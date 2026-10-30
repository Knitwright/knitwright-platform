import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sources = (folder: string): string[] =>
  readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

const importsFabric = (path: string): boolean => /from "fabric(\/[^"]*)?"/.test(readFileSync(join(ROOT, path), "utf8"));

/**
 * Fabric.js only ever runs in a browser and only ever inside a canvas component (decision 0053).
 *
 * Plan v5 Y3 (decision 0076) added the second canvas: the editor's own 2D pattern view. So there
 * are two files that import the library, each loaded by its own `dynamic(..., { ssr: false })`, and
 * the rules that matter are unchanged — no server code and no `lib/` module imports it, the server
 * never evaluates it, and the prototype stays a thing of its own behind its flag.
 */
const CANVASES = ["components/panel-layers/PanelCanvas.tsx", "components/studio/editor/view-2d/PatternCanvas.tsx"];

/** Each canvas and the file that loads it. */
const LOADERS: readonly (readonly [string, string])[] = [
  ["components/panel-layers/PanelLayersEditor.tsx", "./PanelCanvas"],
  ["components/studio/editor/view-2d/PatternView.tsx", "./PatternCanvas"],
];

describe("Fabric.js is loaded only by a canvas component", () => {
  const files = ["app", "components", "lib"].flatMap(sources);

  it("is imported by the two canvas files, and no server code", () => {
    expect(files.filter(importsFabric).sort()).toEqual([...CANVASES].sort());
  });

  it("is never imported by a module under lib/, which the server evaluates", () => {
    expect(sources("lib").filter(importsFabric)).toEqual([]);
  });

  it("is reached through a dynamic import that skips the server", () => {
    for (const [loader, canvas] of LOADERS) {
      const text = readFileSync(join(ROOT, loader), "utf8");
      expect(text, loader).toMatch(new RegExp(`dynamic\\(\\(\\) => import\\("${canvas}"\\)`));
      expect(text, loader).toMatch(/ssr: false/);
    }
  });

  it("keeps the prototype's own components out of the design editor", () => {
    // `@/lib/panel-layers` is shared on purpose: it is pure, it holds no Fabric, and the 2D view is
    // built from it. The prototype's *components* are its own, and the editor does not reach them.
    // An import of a component, which is capitalised; `@/lib/panel-layers/sheet` is not one.
    const reaching = sources("components/studio").filter((path) => /from "[^"]*panel-layers\/[A-Z]/.test(readFileSync(join(ROOT, path), "utf8")));
    expect(reaching).toEqual([]);
  });

  it("keeps the prototype route behind the flag", () => {
    const page = readFileSync(join(ROOT, "app/(app)/studio/[projectId]/layers/page.tsx"), "utf8");
    expect(page).toMatch(/if \(!panelLayersOn\(\)\) notFound\(\)/);
  });
});
