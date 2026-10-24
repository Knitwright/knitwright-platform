import ts from "typescript";
import { localNamesOf, type Imported } from "./source";
import type { Violation } from "./wrapper-check";

/**
 * Every page, layout, template and default under `app/` must check the session itself,
 * unless it is on the list of public pages. A layout's check is not enough: the
 * framework does not run a layout again when the user moves between the pages in it.
 *
 * The check must be written where it is certain to run: as `await requireMember()` (or
 * `const x = await requireMember()`) as the first statement in the body of the default
 * export, so nothing can return before it.
 */

const GUARDS = "@/lib/server/page-guards";
const REQUIRE_MEMBER: Imported = { module: GUARDS, name: "requireMember" };
const REQUIRE_SESSION: Imported = { module: GUARDS, name: "requireSession" };
const REQUIRE_PLATFORM_ADMIN: Imported = { module: GUARDS, name: "requirePlatformAdmin" };

const RENDERED_FILE = /^app\/(.*\/)?(page|layout|template|default)\.[jt]sx?$/;

/** The studio. Its pages are never public. */
const STUDIO = "app/(app)/";

/** Groups where a session is enough. Everywhere else a page needs a brand as well. */
const SESSION_ONLY_GROUPS = ["app/(auth)/", "app/(onboarding)/"];

/** The Knitwright team's pages (decisions 0024 and 0043): the lead list and the ops console. Only a platform admin may see them. */
const ADMIN_GROUPS = ["app/(admin)/", "app/(ops)/"];

const isRenderedFile = (path: string): boolean => RENDERED_FILE.test(path);

const defaultExportBody = (source: ts.SourceFile): ts.Block | undefined =>
  source.statements.find((statement): statement is ts.FunctionDeclaration => {
    if (!ts.isFunctionDeclaration(statement)) return false;
    const kinds = (ts.getModifiers(statement) ?? []).map((modifier) => modifier.kind);
    return (
      kinds.includes(ts.SyntaxKind.ExportKeyword) && kinds.includes(ts.SyntaxKind.DefaultKeyword)
    );
  })?.body;

const isAwaitedCallTo = (expression: ts.Expression | undefined, names: ReadonlySet<string>) =>
  expression !== undefined &&
  ts.isAwaitExpression(expression) &&
  ts.isCallExpression(expression.expression) &&
  ts.isIdentifier(expression.expression.expression) &&
  names.has(expression.expression.expression.text);

/** Whether one statement is the check, waited for, and nothing else around it. */
const isGuardStatement = (statement: ts.Statement, names: ReadonlySet<string>): boolean => {
  if (ts.isExpressionStatement(statement)) return isAwaitedCallTo(statement.expression, names);
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.some((declaration) =>
    isAwaitedCallTo(declaration.initializer, names),
  );
};

const runsGuardFirst = (source: ts.SourceFile, accepted: readonly Imported[]): boolean => {
  const names = new Set(accepted.flatMap((guard) => [...localNamesOf(source, guard)]));
  const [first] = defaultExportBody(source)?.statements ?? [];
  return first !== undefined && isGuardStatement(first, names);
};

export type PageReport = Readonly<{ violations: Violation[]; isPublicPage: boolean }>;

export const checkPage = (
  path: string,
  source: ts.SourceFile,
  publicPages: ReadonlySet<string>,
): PageReport => {
  if (!isRenderedFile(path)) return { violations: [], isPublicPage: false };

  const inStudio = path.startsWith(STUDIO);
  const admin = ADMIN_GROUPS.some((group) => path.startsWith(group));
  if (!inStudio && !admin && publicPages.has(path)) return { violations: [], isPublicPage: true };

  const sessionEnough = SESSION_ONLY_GROUPS.some((group) => path.startsWith(group));
  const accepted = admin ? [REQUIRE_PLATFORM_ADMIN] : sessionEnough ? [REQUIRE_SESSION, REQUIRE_MEMBER] : [REQUIRE_MEMBER];
  if (runsGuardFirst(source, accepted)) return { violations: [], isPublicPage: false };

  const needs = admin ? "requirePlatformAdmin" : sessionEnough ? "requireSession" : "requireMember";
  return {
    isPublicPage: false,
    violations: [
      {
        file: path,
        rule: "page-not-guarded",
        detail: `Write "await ${needs}()" from ${GUARDS} as the first statement in the body of the default export, or list the page in lib/server/public-pages.ts.`,
      },
    ],
  };
};
