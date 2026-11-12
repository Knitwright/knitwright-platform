import { toolHref, type ToolId } from "@/lib/workspace/tools";
import { ruleIdFor } from "@/lib/validation/rules";

/**
 * Where a person goes to put a finding right: the "Fix" link beside "Why?" (spec F-0: "The UI lists each failing
 * check with 'Why?' and 'Fix' links"; plan v6 D1, decision 0132). Plain data, so the panel holds markup only, and
 * no zod: the panel is a client component (tests/architecture/client-weight).
 *
 * The link's words are the finding's own `fix.action`; this only says which screen holds the control. A finding
 * nobody on the brand can fix -- a term the factory has not agreed, or a check that could not run -- has no
 * place, and the panel shows its action and who acts without a link rather than sending the person somewhere
 * that cannot help.
 */

/** Findings about the artwork placed on the garment: the logos tool holds every placed picture. */
const ARTWORK = new Set(["seam-cross", "min-dpi", "bleed-short", "safe-zone"]);
/** Findings about the base article and its parameters: the garment tool holds the Form controls. */
const GARMENT = new Set(["article-not-made", "article-not-set", "article-not-offered"]);
/** Terms only the factory or Knitwright can set. */
const NOWHERE = new Set(["moq-not-set", "lead-time-not-set", "price-ladder-not-set", "check-failed"]);

function toolFor(code: string): ToolId | "tech-pack" | null {
  if (NOWHERE.has(code)) return null;
  if (code.startsWith("readiness-")) return "tech-pack";
  if (ARTWORK.has(code) || code.startsWith("moderation-") || code.startsWith("repeat-")) return "logos";
  if (code === "gamut-approx") return "colours";
  if (GARMENT.has(code) || code.startsWith("parameter-")) return "garment";
  return null;
}

/** The address of the screen that fixes a finding of `code` in this design, or null when no screen of the brand's does. */
export function fixHref(projectId: string, code: string): string | null {
  const tool = toolFor(code);
  if (tool === null) return null;
  return tool === "tech-pack" ? `/studio/${encodeURIComponent(projectId)}/tech-pack` : toolHref(projectId, tool);
}

/** The rule a finding answers to: its own where it carries one, else the rule of its code. */
export const ruleOf = (found: Readonly<{ code: string; ruleId?: string }>): string => found.ruleId ?? ruleIdFor(found.code);
