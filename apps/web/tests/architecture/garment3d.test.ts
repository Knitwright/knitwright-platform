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
function valueImports(path: string): string[] {
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

const THREE_D = /^(three|three\/.*|delaunator|lib\/garment3d\/(mesh|triangulate)|components\/garment3d\/.*)$/;
const inside3d = (path: string): boolean => path.startsWith("lib/garment3d/") || path.startsWith("components/garment3d/");

describe("3D code is loaded only when the 3D view is opened", () => {
  const files = FOLDERS.flatMap(sources);

  it("is imported only from the 3D folders", () => {
    const offenders = files.filter((path) => !inside3d(path) && valueImports(path).some((module) => THREE_D.test(module)));
    expect(offenders).toEqual([]);
  });

  it("keeps three.js in one file", () => {
    const users = files.filter((path) => valueImports(path).some((module) => /^three(\/|$)/.test(module)));
    expect(users).toEqual(["components/garment3d/scene.ts"]);
  });

  it("is reached from the editor through a dynamic import", () => {
    const text = readFileSync(join(ROOT, "components/studio/Preview3D.tsx"), "utf8");
    expect(text).toMatch(/dynamic\(\(\) => import\("@\/components\/garment3d\/GarmentViewer"\)/);
  });
});
