import { scanText } from "./security";
import { refuse } from "./refusal";

/** The style properties the model understands. Anything else in a style is dropped. */
export const STYLE_PROPERTIES = new Set([
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity",
  "fill-opacity", "stroke-opacity", "fill-rule", "clip-rule", "display", "visibility", "stop-color",
  "stop-opacity", "color", "clip-path",
]);

export type Declarations = ReadonlyMap<string, string>;

/** Reads `a: b; c: d` into properties. Text with a script, an import or an outside address is refused. */
export const parseDeclarations = (text: string): Declarations => {
  scanText(text);
  const out = new Map<string, string>();
  for (const part of text.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const name = part.slice(0, colon).trim().toLowerCase();
    if (STYLE_PROPERTIES.has(name)) out.set(name, part.slice(colon + 1).replace(/!important/i, "").trim());
  }
  return out;
};

export type Rule = Readonly<{ selectors: readonly string[]; declarations: Declarations }>;

/**
 * Reads a style sheet of simple rules: element and class selectors in a list. An `@import` is refused; other
 * `@` rules and selectors we do not understand are left out, and the count of those is returned for a warning.
 */
export const parseStyleSheet = (text: string): { rules: Rule[]; skipped: number } => {
  scanText(text);
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/@import/i.test(stripped)) refuse("stylesheetImport");
  const rules: Rule[] = [];
  // A rule inside an @media or similar block is not applied, so its block counts as left out.
  let skipped = (stripped.match(/@/g) ?? []).length;
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stripped.matchAll(pattern)) {
    const selectors = match[1].split(",").map((selector) => selector.trim());
    const simple = selectors.every((selector) => /^(?:[a-z]+|\.[\w-]+|[a-z]+\.[\w-]+)$/i.test(selector));
    if (!simple || selectors.some((selector) => selector.startsWith("@"))) {
      skipped += 1;
      continue;
    }
    rules.push({ selectors, declarations: parseDeclarations(match[2]) });
  }
  return { rules, skipped };
};

/** Whether a simple selector matches an element name and class list. */
export const selectorMatches = (selector: string, name: string, classes: readonly string[]): boolean => {
  const dot = selector.indexOf(".");
  if (dot < 0) return selector.toLowerCase() === name;
  const tag = selector.slice(0, dot).toLowerCase();
  return (tag === "" || tag === name) && classes.includes(selector.slice(dot + 1));
};
