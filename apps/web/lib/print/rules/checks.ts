import type { PrintRuleSet } from "@/lib/production/contract";
import type { PrintIssue } from "../scene";
import { outlineText } from "../text/outline";

/**
 * The smallest a name is printed when no rule says. A Knitwright default, not a competition's rule;
 * the file says so when it is what held a name back.
 */
const DEFAULT_MIN_NAME_HEIGHT_MM = 35;
const DEFAULT_MIN_NAME_LABEL = "Knitwright default, not from your print house";

export const effectiveDpi = (widthPx: number, printedWidthMm: number): number => (widthPx / printedWidthMm) * 25.4;

/** The widest a picture can be printed and still meet the dpi asked for, in millimetres. */
export const largestWidthMm = (widthPx: number, minDpi: number): number => (widthPx / minDpi) * 25.4;

export function dpiIssue(dpi: number, minDpi: number): PrintIssue | null {
  if (dpi >= minDpi) return null;
  return {
    severity: "warn",
    text: `This picture would print at about ${Math.round(dpi)} dpi at this size. Your print house asks for ${minDpi} or more, so it may look soft. Use a larger file, or make it smaller on the shirt.`,
  };
}

interface TextFit {
  /** The height to print at, or null when the text does not fit even at the smallest height. */
  readonly heightMm: number | null;
  readonly widthMm: number;
  readonly issues: readonly PrintIssue[];
}

/**
 * Fits a line of text into a zone's width. It starts at the height asked for and steps down to the smallest height
 * allowed. If it still does not fit it is NOT squeezed or drawn: the result has no height and says so.
 */
export function fitText(text: string, wantedMm: number, zoneWidthMm: number, rules: PrintRuleSet, label: string): TextFit {
  const minimum = rules.minTextHeightMm ?? DEFAULT_MIN_NAME_HEIGHT_MM;
  const where = rules.minTextHeightMm === null ? ` (${DEFAULT_MIN_NAME_LABEL})` : "";
  const widthAt = (height: number): number => outlineText(text, height).widthMm;
  const atWanted = widthAt(wantedMm);
  if (atWanted <= zoneWidthMm) return { heightMm: wantedMm, widthMm: atWanted, issues: textHeightIssues(wantedMm, rules, label) };
  const fitted = Math.floor((wantedMm * zoneWidthMm * 10) / atWanted) / 10;
  if (fitted >= minimum) {
    return { heightMm: fitted, widthMm: widthAt(fitted), issues: [{ severity: "note", text: `${label} was made ${fitted} mm tall so it fits its place.` }, ...textHeightIssues(fitted, rules, label)] };
  }
  return {
    heightMm: null,
    widthMm: atWanted,
    issues: [{ severity: "stop", text: `${label} does not fit its place at the smallest height of ${minimum} mm${where}, so it was left off. Use a shorter name or a smaller height.` }],
  };
}

export function textHeightIssues(heightMm: number, rules: PrintRuleSet, label: string): PrintIssue[] {
  const min = rules.minTextHeightMm;
  return min !== null && heightMm < min ? [{ severity: "warn", text: `${label} is ${heightMm} mm tall, under the smallest your print house asks for (${min} mm).` }] : [];
}

/** League rules for a number: its height and its size. Empty when no rule is set. */
export function numberIssues(digits: string, heightMm: number, rules: PrintRuleSet): PrintIssue[] {
  const rule = rules.numberRules;
  if (rule === null) return [];
  const found: PrintIssue[] = [];
  if (heightMm < rule.minHeightMm || heightMm > rule.maxHeightMm) {
    found.push({ severity: "warn", text: `Number ${digits} is ${heightMm} mm tall; ${rule.source} allows ${rule.minHeightMm} to ${rule.maxHeightMm} mm.` });
  }
  // The rule's `allowedDigits` is read as the highest number the competition allows, for example "99".
  if (rule.allowedDigits !== null && Number(digits) > Number(rule.allowedDigits)) {
    found.push({ severity: "warn", text: `Number ${digits} is above the highest number ${rule.source} allows (${rule.allowedDigits}).` });
  }
  return found;
}

export function lineIssue(widthMm: number, rules: PrintRuleSet, label: string): PrintIssue | null {
  return rules.minLineMm !== null && widthMm < rules.minLineMm
    ? { severity: "warn", text: `${label} has a line ${widthMm} mm wide, thinner than the ${rules.minLineMm} mm your print house asks for.` }
    : null;
}

export function avoidIssues(colours: readonly string[]): PrintIssue[] {
  return colours.map((colour) => ({ severity: "warn", text: `Colour ${colour} is one your print house says does not sublimate well.` }));
}
