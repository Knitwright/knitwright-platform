import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parse } from "./source";

/**
 * Step 9A: the rest of the app loads no 3D code until a person opens the 3D view. Only
 * the 3D folders may import three.js, the triangle library or the form builder, and the
 * editor reaches the viewer only through a dynamic import.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FOLDERS = ["app", "components", "lib"];

function sources(folder: string): string[] {
  return readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

/** Modules a file imports for their values (type-only imports load nothing), written from the app root. */
const importsOf = new Map<string, string[]>();
function valueImports(path: string): string[] {
  const known = importsOf.get(path);
  if (known) return known;
  const found = readValueImports(path);
  importsOf.set(path, found);
  return found;
}

function readValueImports(path: string): string[] {
  const source = parse({ path, text: readFileSync(join(ROOT, path), "utf8") });
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    if (statement.importClause?.isTypeOnly) return [];
    const bindings = statement.importClause?.namedBindings;
    const allTypes = !statement.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((element) => element.isTypeOnly);
    if (allTypes) return [];
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith("@/")) return [specifier.slice(2)];
    if (specifier.startsWith(".")) return [posix.join(posix.dirname(path), specifier)];
    return [specifier];
  });
}

const THREE_D = /^(three|three\/.*|delaunator|lib\/garment3d\/(mesh|triangulate)|components\/(garment3d|gltf)\/.*)$/;
const FOLDERS_3D = ["lib/garment3d/", "components/garment3d/", "lib/gltf/", "components/gltf/"];
/**
 * The teamwear configurator's stage (plan v5 Z5) has its own 3D scene, because the stage needs five
 * views and `components/garment3d/scene.ts` offers two. Both files sit in the chunk the configurator
 * fetches through `next/dynamic`, which the last check of this file asserts, so the rule this file
 * exists for still holds: no page loads 3D code until a stage is on the screen.
 */
const DYNAMIC_3D = ["components/teamwear/KitStage.tsx", "components/teamwear/stage-scene.ts"];
const inside3d = (path: string): boolean => FOLDERS_3D.some((folder) => path.startsWith(folder)) || DYNAMIC_3D.includes(path);

// Each check reads and parses every file of the app, which takes several seconds on a loaded runner with coverage on.
const SCAN_MS = 30_000;

describe("3D code is loaded only when the 3D view is opened", () => {
  const files = FOLDERS.flatMap(sources);

  it("is imported only from the 3D folders", () => {
    const offenders = files.filter((path) => !inside3d(path) && valueImports(path).some((module) => THREE_D.test(module)));
    expect(offenders).toEqual([]);
  }, SCAN_MS);

  it("keeps three.js in one file for each 3D viewer", () => {
    const users = files.filter((path) => valueImports(path).some((module) => /^three(\/|$)/.test(module)));
    expect(users).toEqual(["components/garment3d/scene.ts", "components/gltf/scene.ts", "components/teamwear/stage-scene.ts"]);
  }, SCAN_MS);

  it("keeps the glTF library free of three.js, so the pipeline runs on the server and in tests", () => {
    const offenders = files.filter((path) => path.startsWith("lib/gltf/") && valueImports(path).some((module) => /^three(\/|$)/.test(module)));
    expect(offenders).toEqual([]);
  }, SCAN_MS);

  it("is reached from the editor through a dynamic import", () => {
    const text = readFileSync(join(ROOT, "components/studio/Preview3D.tsx"), "utf8");
    expect(text).toMatch(/dynamic\(\(\) => import\("@\/components\/garment3d\/GarmentViewer"\)/);
  });

  it("is reached from the teamwear configurator through a dynamic import", () => {
    const text = readFileSync(join(ROOT, "components/teamwear/Configurator.tsx"), "utf8");
    expect(text).toMatch(/dynamic\(\(\) => import\("\.\/KitStage"\)/);
  });
});
