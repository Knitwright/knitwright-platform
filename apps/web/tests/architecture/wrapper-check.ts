import ts from "typescript";

/**
 * Reads source files without running them and reports every route handler and server
 * action that is not the output of `defineRoute` or `defineAction`. This is invariant
 * I3 in plans/knitwright-mvp-blueprint.md.
 */

export type SourceText = Readonly<{
  /** Path from the app root, with forward slashes: "app/api/me/route.ts". */
  path: string;
  text: string;
}>;

export type Rule =
  | "route-not-wrapped"
  | "action-not-wrapped"
  | "inline-use-server"
  | "auth-not-literal"
  | "public-not-listed"
  | "stale-allow-entry";

export type Violation = Readonly<{ file: string; rule: Rule; detail: string }>;

const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const ROUTE_FILE = /(^|\/)route\.tsx?$/;
const DIRECTIVE = "use server";

const ROUTE_WRAPPER = { module: "@/lib/server/define-route", name: "defineRoute" } as const;
const ACTION_WRAPPER = { module: "@/lib/server/define-action", name: "defineAction" } as const;

type Wrapper = typeof ROUTE_WRAPPER | typeof ACTION_WRAPPER;

/** One value a file exports. `initializer` is missing when it cannot be a wrapper call. */
type ValueExport = Readonly<{ name: string; initializer?: ts.Expression }>;

const parse = ({ path, text }: SourceText): ts.SourceFile =>
  ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const hasDirective = (statements: ts.NodeArray<ts.Statement>): boolean => {
  for (const statement of statements) {
    const isPrologue =
      ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression);
    if (!isPrologue) return false;
    if ((statement.expression as ts.StringLiteral).text === DIRECTIVE) return true;
  }
  return false;
};

const countInlineDirectives = (source: ts.SourceFile): number => {
  let count = 0;
  const visit = (node: ts.Node): void => {
    const body = ts.isFunctionLike(node) && "body" in node ? node.body : undefined;
    if (body && ts.isBlock(body) && hasDirective(body.statements)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
};

/** The names under which this file imported the wrapper from its one true module. */
const localNamesOf = (source: ts.SourceFile, wrapper: Wrapper): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== wrapper.module) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === wrapper.name) {
        names.add(element.name.text);
      }
    }
  }
  return names;
};

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const isDefault = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);

const exportsOfStatement = (statement: ts.Statement): ValueExport[] => {
  if (ts.isExportAssignment(statement)) return [{ name: "default" }];

  if (ts.isExportDeclaration(statement)) {
    if (statement.isTypeOnly) return [];
    const clause = statement.exportClause;
    if (!clause) return [{ name: "*" }];
    if (!ts.isNamedExports(clause)) return [{ name: clause.name.text }];
    return clause.elements
      .filter((element) => !element.isTypeOnly)
      .map((element) => ({ name: element.name.text }));
  }

  if (!isExported(statement)) return [];

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => ({
      name: declaration.name.getText(),
      initializer: declaration.initializer,
    }));
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return [{ name: isDefault(statement) ? "default" : (statement.name?.text ?? "default") }];
  }
  // Types, interfaces and the like carry no runtime value.
  return [];
};

const valueExportsOf = (source: ts.SourceFile): ValueExport[] =>
  source.statements.flatMap(exportsOfStatement);

const wrapperCallOf = (
  candidate: ValueExport,
  localNames: ReadonlySet<string>,
): ts.CallExpression | undefined => {
  const { initializer } = candidate;
  if (!initializer || !ts.isCallExpression(initializer)) return undefined;
  const callee = initializer.expression;
  return ts.isIdentifier(callee) && localNames.has(callee.text) ? initializer : undefined;
};

/** The `auth` value when it is written out as a literal that nothing can overwrite. */
const literalAuthOf = (call: ts.CallExpression): string | undefined => {
  const [config] = call.arguments;
  if (!config || !ts.isObjectLiteralExpression(config)) return undefined;
  if (config.properties.some(ts.isSpreadAssignment)) return undefined;
  const auth = config.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && property.name.getText() === "auth",
  );
  if (!auth || !ts.isStringLiteral(auth.initializer)) return undefined;
  return auth.initializer.text;
};

type FileReport = Readonly<{ violations: Violation[]; publicEntries: string[] }>;

const checkExports = (
  file: string,
  candidates: ValueExport[],
  localNames: ReadonlySet<string>,
  rule: "route-not-wrapped" | "action-not-wrapped",
  allowList: ReadonlySet<string>,
): FileReport => {
  const violations: Violation[] = [];
  const publicEntries: string[] = [];

  for (const candidate of candidates) {
    const call = wrapperCallOf(candidate, localNames);
    if (!call) {
      violations.push({
        file,
        rule,
        detail: `Export "${candidate.name}" is not the output of the wrapper.`,
      });
      continue;
    }

    const auth = literalAuthOf(call);
    if (auth !== "user" && auth !== "public") {
      violations.push({
        file,
        rule: "auth-not-literal",
        detail: `Export "${candidate.name}" must write auth as "user" or "public", with no spread.`,
      });
      continue;
    }

    if (auth === "public") {
      const entry = `${file}#${candidate.name}`;
      publicEntries.push(entry);
      if (!allowList.has(entry)) {
        violations.push({
          file,
          rule: "public-not-listed",
          detail: `"${entry}" is public but is not in lib/server/public-routes.ts.`,
        });
      }
    }
  }

  return { violations, publicEntries };
};

const checkFile = (file: SourceText, allowList: ReadonlySet<string>): FileReport => {
  const source = parse(file);
  const inline: Violation[] = Array.from({ length: countInlineDirectives(source) }, () => ({
    file: file.path,
    rule: "inline-use-server" as const,
    detail: 'A function contains "use server". Put the action in a server file instead.',
  }));

  const exported = valueExportsOf(source);
  const reports: FileReport[] = [];

  if (ROUTE_FILE.test(file.path)) {
    const handlers = exported.filter(({ name }) => HTTP_METHODS.has(name) || name === "*");
    reports.push(
      checkExports(
        file.path,
        handlers,
        localNamesOf(source, ROUTE_WRAPPER),
        "route-not-wrapped",
        allowList,
      ),
    );
  }

  if (hasDirective(source.statements)) {
    reports.push(
      checkExports(
        file.path,
        exported,
        localNamesOf(source, ACTION_WRAPPER),
        "action-not-wrapped",
        allowList,
      ),
    );
  }

  return {
    violations: [...inline, ...reports.flatMap((report) => report.violations)],
    publicEntries: reports.flatMap((report) => report.publicEntries),
  };
};

export const checkWrappers = (
  files: readonly SourceText[],
  allowList: readonly string[],
): Violation[] => {
  const allowed = new Set(allowList);
  const reports = files.map((file) => checkFile(file, allowed));
  const publicEntries = new Set(reports.flatMap((report) => report.publicEntries));

  const stale: Violation[] = allowList
    .filter((entry) => !publicEntries.has(entry))
    .map((entry) => ({
      file: "lib/server/public-routes.ts",
      rule: "stale-allow-entry" as const,
      detail: `"${entry}" is on the allow list but no public route or action matches it.`,
    }));

  return [...reports.flatMap((report) => report.violations), ...stale];
};
