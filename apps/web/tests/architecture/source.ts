import ts from "typescript";

/** Reading source files without running them. Shared by the architecture checks. */

export type SourceText = Readonly<{
  /** Path from the app root, with forward slashes: "app/api/me/route.ts". */
  path: string;
  text: string;
}>;

/** A function that must come from one module, whatever name a file imports it under. */
export type Imported = Readonly<{ module: string; name: string }>;

const scriptKindOf = (path: string): ts.ScriptKind => {
  if (/\.tsx$/.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(path)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

export const parse = ({ path, text }: SourceText): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));

/** The names under which this file imported the function from its one true module. */
export const localNamesOf = (source: ts.SourceFile, wanted: Imported): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== wanted.module) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === wanted.name) {
        names.add(element.name.text);
      }
    }
  }
  return names;
};

/** Whether the file calls a function it imported under one of these names. */
export const calls = (source: ts.SourceFile, names: ReadonlySet<string>): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      found = names.has(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};
