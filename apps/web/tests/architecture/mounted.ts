import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse } from "./source";

/**
 * TWO SWEEPS FOR ONE KIND OF HOLE: code that is built, tested and reachable by nobody.
 *
 * The v5 review found panels that existed with no screen importing them and server actions with no
 * button calling them -- a whole design-import panel, an artwork panel, the launch packs, three
 * deletes. Every one of them passed the type checker, the unit tests and the coverage floor,
 * because none of those asks the only question that matters: **can a person get to it?**
 *
 * `componentSweep` answers it for a component: is it reachable, through imports, from an
 * `app/**` page, layout or route? `actionSweep` answers it for a server action: does any file
 * outside its own module actually use it, as opposed to re-exporting its name?
 *
 * Both read the source with the TypeScript parser rather than matching text, so a name inside a
 * comment, a string or a barrel's `export { x } from "./y"` is not mistaken for a use.
 */

const WEB = fileURLToPath(new URL("../../", import.meta.url));

/** Not source a person can reach: the build's own output, the packages, a report. */
const SKIP_ANYWHERE = new Set(["node_modules", ".next", "test-results", "playwright-report", "coverage"]);

/**
 * The two test trees, skipped by their path from the app root, not by their name. **A test may not
 * stand in for a caller**: an action called only from `e2e/support.ts`, or a route whose address is
 * only written down in a test helper, is still a thing no person can reach, and the sweep must say
 * so. The name alone would be too much to go on -- `app/api/fabrics/[fabricId]/tests/route.ts` is a
 * route a person can reach, in a directory called `tests`.
 */
const SKIP_AT_ROOT = new Set(["tests", "e2e"]);

const IS_SOURCE = /\.tsx?$/;
const IS_TEST = /\.(test|spec)\.tsx?$/;

/** A page, layout, route or other file Next.js itself renders: where a person can arrive. */
const ROUTE_FILE = /^app\/(?:.*\/)?(page|layout|route|template|default|error|not-found|loading|global-error)\.tsx?$/;
const OTHER_ROOTS = new Set(["middleware.ts", "instrumentation.ts"]);

export type Path = string;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // The app-relative path, not the name: "tests" at the root is the test tree, and
      // "app/api/fabrics/[fabricId]/tests" is a route. Comparing `dir` with the root would miss,
      // because the walk starts at the root with its trailing slash still on it.
      const where = relative(WEB, join(dir, entry.name)).replaceAll("\\", "/");
      const skip = SKIP_ANYWHERE.has(entry.name) || SKIP_AT_ROOT.has(where);
      if (!skip) walk(join(dir, entry.name), out);
    } else if (IS_SOURCE.test(entry.name) && !IS_TEST.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
};

const appPath = (file: string): Path => relative(WEB, file).replaceAll("\\", "/");

const read = (file: string): ts.SourceFile => parse({ path: appPath(file), text: readFileSync(file, "utf8") });

/** Every module specifier a file pulls in: static imports, re-exports and dynamic `import()`. */
export function specifiersOf(source: ts.SourceFile): readonly string[] {
  const found: string[] = [];
  for (const statement of source.statements) {
    const spec =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : null;
    if (spec !== null) found.push(spec);
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) found.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The file a specifier names, or null for a package or a file outside the app. */
const resolveSpec = (from: string, spec: string): string | null => {
  const base = spec.startsWith("@/") ? join(WEB, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (base === null) return null;
  const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((suffix) => base + suffix).find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return found !== undefined && IS_SOURCE.test(found) ? found : null;
};

export type ComponentSweep = Readonly<{
  /** Every source file the sweep looked at, as app-relative paths. */
  files: readonly Path[];
  roots: readonly Path[];
  reached: ReadonlySet<Path>;
  /** Files under `components/` that no page, layout or route can reach. */
  unmounted: readonly Path[];
}>;

/**
 * Which files a person can reach. An edge is any import, including a type-only one: that is what
 * the orchestrator's own sweep counted, and counting fewer edges would turn every file reached only
 * for its types into a finding of its own, which is a different piece of work (see decision 0124).
 */
export function componentSweep(): ComponentSweep {
  const files = walk(WEB);
  const paths = files.map(appPath);
  const edges = new Map<string, readonly string[]>(
    files.map((file) => [file, specifiersOf(read(file)).flatMap((spec) => resolveSpec(file, spec) ?? [])]),
  );
  const roots = files.filter((file) => {
    const path = appPath(file);
    return ROUTE_FILE.test(path) || OTHER_ROOTS.has(path);
  });

  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of edges.get(file) ?? []) if (!seen.has(next)) stack.push(next);
  }

  const reached = new Set([...seen].map(appPath));
  return {
    files: paths,
    roots: roots.map(appPath),
    reached,
    unmounted: paths.filter((path) => path.startsWith("components/") && !reached.has(path)).sort(),
  };
}

export type ActionSweep = Readonly<{
  /** Every `"use server"` file found, as app-relative paths. */
  modules: readonly Path[];
  /** Every exported `…Action`, as "path: name". */
  actions: readonly string[];
  /** The ones no file outside their own module uses, as "path: name". */
  unused: readonly string[];
}>;

const isServerModule = (text: string): boolean => /^\s*["']use server["']/.test(text);

/** The exported `…Action` constants of one `"use server"` module. */
export function actionsIn(source: ts.SourceFile): readonly string[] {
  const names: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text.endsWith("Action")) names.push(declaration.name.text);
    }
  }
  return names;
}

/**
 * The names a file really uses, as opposed to the names it only passes along. An identifier inside
 * an import or export clause is not a use: `export { saveAction } from "./actions"` in a barrel
 * says nothing about whether anything calls it, and a text search cannot tell the two apart.
 */
export function usedNames(source: ts.SourceFile): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

export function actionSweep(): ActionSweep {
  const files = walk(WEB);
  const sources = files.map((file) => ({ file, path: appPath(file), text: readFileSync(file, "utf8") }));
  const modules = sources.filter((one) => isServerModule(one.text));
  const uses = sources.map((one) => ({ path: one.path, names: usedNames(parse({ path: one.path, text: one.text })) }));

  const actions: string[] = [];
  const unused: string[] = [];
  for (const server of modules) {
    for (const name of actionsIn(parse({ path: server.path, text: server.text }))) {
      actions.push(`${server.path}: ${name}`);
      const used = uses.some((one) => one.path !== server.path && one.names.has(name));
      if (!used) unused.push(`${server.path}: ${name}`);
    }
  }
  return { modules: modules.map((one) => one.path), actions: actions.sort(), unused: unused.sort() };
}

export type RouteSweep = Readonly<{
  /** Every API route's own address, with its dynamic segments as Next.js writes them. */
  routes: readonly string[];
  /** The ones no source file outside `app/api` names. */
  unfetched: readonly string[];
}>;

const API_ROUTE = /^app\/api\/.*\/route\.ts$/;

/** The address a route answers on: `app/api/artwork/[artworkId]/route.ts` is `/api/artwork/[artworkId]`. */
export const addressOf = (path: Path): string => `/${path.replace(/^app\//, "").replace(/\/route\.ts$/, "").replace(/\(.*?\)\//g, "")}`;

/**
 * Every address a file writes down: a plain string, and a template with its substitutions as `*`
 * (`` `/api/artwork/${id}/tile` `` is `/api/artwork/* /tile`), so a path built around an id still
 * names its route. Comments are not addresses: a route named only in a sentence has no caller.
 */
export function addressesIn(source: ts.SourceFile): readonly string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) found.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      found.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("*"));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.filter((text) => text.includes("/api/"));
}

/** Where the address stops being literal: what a caller has to write before any id of its own. */
const staticPrefix = (address: string): string => address.split("/[")[0] ?? address;

/**
 * Whether an address a file writes down names this route. The prefix must end where a segment ends,
 * so `/api/fabrics` does not count as a mention of `/api/fabrics-anything`.
 */
const names = (written: string, prefix: string): boolean => {
  const at = written.indexOf(prefix);
  if (at < 0) return false;
  const after = written[at + prefix.length];
  return after === undefined || after === "/" || after === "?" || after === "#" || after === '"' || after === "'";
};

export function routeSweep(): RouteSweep {
  const files = walk(WEB).map((file) => ({ file, path: appPath(file) }));
  const routes = files.filter((one) => API_ROUTE.test(one.path));
  const written = files
    .filter((one) => !API_ROUTE.test(one.path))
    .flatMap((one) => addressesIn(read(one.file)));

  const addresses = routes.map((one) => addressOf(one.path));
  return {
    routes: [...addresses].sort(),
    unfetched: addresses.filter((address) => !written.some((text) => names(text, staticPrefix(address)))).sort(),
  };
}

/** Whether a path names a file that is really there, so an allow-list cannot keep a dead entry. */
export const exists = (path: Path): boolean => existsSync(join(WEB, path));
