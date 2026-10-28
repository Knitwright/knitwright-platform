import { sizingSchema, type Sizing, type SpecAction } from "@/lib/garment";

/**
 * Turns what a person typed into the size run of a design. The rules are the design
 * contract's own, so the messages are too. This file only reads the text and puts each
 * message beside the field it belongs to.
 */

type SizingFormResult =
  | Readonly<{ ok: true; action: Extract<SpecAction, { type: "set-sizing" }> }>
  | Readonly<{ ok: false; errors: Readonly<{ sizes?: string; baseSize?: string }> }>;

/** Size labels typed as "S, M, L". Empty pieces are ignored. */
export const parseSizeLabels = (text: string): string[] =>
  text
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

/** The sizes of a design as a person would type them. */
export const sizesText = (sizing: Sizing | null): string => (sizing ? sizing.sizes.join(", ") : "");

const CHOOSE_BASE = "Choose the base size.";

export const sizingActionFromForm = (sizesInput: string, baseSize: string): SizingFormResult => {
  const labels = parseSizeLabels(sizesInput);
  const parsed = sizingSchema.safeParse({ sizes: labels, baseSize: baseSize.trim() });
  if (parsed.success) {
    return { ok: true, action: { type: "set-sizing", sizing: parsed.data } };
  }

  const errors: { sizes?: string; baseSize?: string } = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] === "baseSize" ? "baseSize" : "sizes";
    // With no sizes yet, "the base size must be one of them" only adds noise.
    const noise = field === "baseSize" && labels.length === 0 && baseSize.trim() !== "";
    if (errors[field] || noise) continue;
    errors[field] = messageFor(issue, field, baseSize);
  }
  return { ok: false, errors };
};

type Issue = Readonly<{ code: string; message: string; path: readonly PropertyKey[]; maximum?: unknown }>;

const messageFor = (issue: Issue, field: "sizes" | "baseSize", baseSize: string): string => {
  if (field === "baseSize" && baseSize.trim() === "") return CHOOSE_BASE;
  // Too many sizes is reported on the list itself. A label that is too long is reported on the label.
  const listIsTooLong = issue.code === "too_big" && issue.path.length === 1 && typeof issue.maximum === "number";
  return listIsTooLong ? `Use ${String(issue.maximum)} sizes or fewer.` : issue.message;
};
