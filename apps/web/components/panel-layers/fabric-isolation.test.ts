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

describe("Fabric.js is loaded only by the prototype", () => {
  const files = ["app", "components", "lib"].flatMap(sources);

  it("is imported by one file, and no server code", () => {
    expect(files.filter(importsFabric)).toEqual(["components/panel-layers/PanelCanvas.tsx"]);
  });

  it("is reached from the editor through a dynamic import that skips the server", () => {
    const text = readFileSync(join(ROOT, "components/panel-layers/PanelLayersEditor.tsx"), "utf8");
    expect(text).toMatch(/dynamic\(\(\) => import\("\.\/PanelCanvas"\)/);
    expect(text).toMatch(/ssr: false/);
  });

  it("is not reached from the design editor", () => {
    const editor = sources("components/studio").filter((path) => /panel-layers/.test(readFileSync(join(ROOT, path), "utf8")));
    expect(editor).toEqual([]);
  });

  it("keeps the prototype route behind the flag", () => {
    const page = readFileSync(join(ROOT, "app/(app)/studio/[projectId]/layers/page.tsx"), "utf8");
    expect(page).toMatch(/if \(!panelLayersOn\(\)\) notFound\(\)/);
  });
});
