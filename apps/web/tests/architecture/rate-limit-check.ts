import ts from "typescript";
import { localNamesOf, parse, type Imported, type SourceText } from "./source";

/**
 * Reads source files without running them and reports every wrapper call whose rate limit is not
 * one of the named rules in lib/server/limits.ts. Together with the wrapper check (every route and
 * action is wrapper output) this proves every entry point is rate limited by a rule someone chose.
 * Plan step 26, task 2.
 */

type RateLimitViolation = Readonly<{ file: string; detail: string }>;

const WRAPPERS: readonly Imported[] = [
  { module: "@/lib/server/define-route", name: "defineRoute" },
  { module: "@/lib/server/define-action", name: "defineAction" },
];

const LIMITS: Imported = { module: "@/lib/server/limits", name: "LIMITS" };

type WrapperCall = Readonly<{ file: string; line: number; rule: string | null }>;

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** The name after `LIMITS.` when the property is written as exactly that, or null. */
const ruleOf = (config: ts.Expression, limitsNames: ReadonlySet<string>): string | null => {
  if (!ts.isObjectLiteralExpression(config)) return null;
  if (config.properties.some(ts.isSpreadAssignment)) return null;
  const property = config.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && candidate.name.getText() === "rateLimit",
  );
  const value = property?.initializer;
  if (!value || !ts.isPropertyAccessExpression(value)) return null;
  const target = value.expression;
  return ts.isIdentifier(target) && limitsNames.has(target.text) ? value.name.text : null;
};

/** Every call to a wrapper in these files, with the rule it names. */
export const wrapperCalls = (files: readonly SourceText[]): WrapperCall[] =>
  files.flatMap((file) => {
    const source = parse(file);
    const wrappers = new Set(WRAPPERS.flatMap((wrapper) => [...localNamesOf(source, wrapper)]));
    if (wrappers.size === 0) return [];
    const limitsNames = localNamesOf(source, LIMITS);
    const found: WrapperCall[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && wrappers.has(node.expression.text)) {
        const [config] = node.arguments;
        found.push({ file: file.path, line: lineOf(source, node), rule: config ? ruleOf(config, limitsNames) : null });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  });

export const checkRateLimits = (
  files: readonly SourceText[],
  ruleNames: readonly string[],
): RateLimitViolation[] => {
  const known = new Set(ruleNames);
  return wrapperCalls(files)
    .filter((call) => call.rule === null || !known.has(call.rule))
    .map((call) => ({
      file: call.file,
      detail:
        call.rule === null
          ? `Line ${call.line}: write the rate limit as "rateLimit: LIMITS.<name>", imported from @/lib/server/limits.`
          : `Line ${call.line}: LIMITS.${call.rule} is not a rule in lib/server/limits.ts.`,
    }));
};
