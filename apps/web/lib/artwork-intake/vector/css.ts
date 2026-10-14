import { refuse, REFUSALS } from "./refuse";
import { checkValue } from "./xml";

/**
 * The small part of CSS that design apps write into an SVG: rules of the form `.cls-1, rect { fill: red }`.
 * Selectors with combinators, pseudo classes and attributes are skipped (and counted); an import is refused.
 */

export type CssRule = Readonly<{ tag: string | null; classes: readonly string[]; id: string | null; declarations: Readonly<Record<string, string>> }>;

export type CssRules = Readonly<{ rules: readonly CssRule[]; skipped: number }>;

const SIMPLE = /^(\*|[A-Za-z][\w-]*)?((?:\.[\w-]+)*)(#[\w-]+)?$/;
const MAX_RULES = 5000;

export function parseDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const name = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).replace(/!\s*important/i, "").trim();
    if (!/^[a-z-]{1,40}$/.test(name) || value === "") continue;
    checkValue(value);
    out[name] = value;
  }
  return out;
}

export function parseCss(source: string): CssRules {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/@import/i.test(stripped)) refuse(REFUSALS.external);
  // Blocks of at-rules (media queries, font faces) are not read.
  let skipped = 0;
  const text = stripped.replace(/@[^{;]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, () => {
    skipped += 1;
    return "";
  });
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (rules.length >= MAX_RULES) return refuse(REFUSALS.tooComplex);
    const selectors = match[1].trim();
    const declarations = parseDeclarations(match[2]);
    for (const selector of selectors.split(",").map((s) => s.trim())) {
      const parts = SIMPLE.exec(selector);
      if (!parts || selector === "") {
        skipped += 1;
        continue;
      }
      rules.push({
        tag: parts[1] && parts[1] !== "*" ? parts[1].toLowerCase() : null,
        classes: parts[2] ? parts[2].split(".").filter(Boolean) : [],
        id: parts[3] ? parts[3].slice(1) : null,
        declarations,
      });
    }
  }
  return { rules, skipped };
}

/** The declarations of every rule that applies to an element, later rules over earlier ones. */
export function matchRules(rules: readonly CssRule[], element: Readonly<{ name: string; attrs: Readonly<Record<string, string>> }>): Record<string, string> {
  const classes = (element.attrs.class ?? "").split(/\s+/).filter(Boolean);
  const out: Record<string, string> = {};
  for (const rule of rules) {
    const matches =
      (rule.tag === null || rule.tag === element.name.toLowerCase()) &&
      rule.classes.every((name) => classes.includes(name)) &&
      (rule.id === null || rule.id === element.attrs.id);
    if (matches) Object.assign(out, rule.declarations);
  }
  return out;
}
