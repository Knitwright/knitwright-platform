import { EMPTY_FABRIC_DETAILS } from "./parts";
import type { Wearer } from "./primitives";
import { getType } from "./registry";
import { SPEC_SCHEMA_VERSION, garmentSpecSchema, type GarmentSpec } from "./spec-schema";

export type { GarmentSpec } from "./spec-schema";

export type SpecResult =
  | { readonly ok: true; readonly spec: GarmentSpec }
  | { readonly ok: false; readonly reason: string };

export type ValidationResult =
  | { readonly ok: true; readonly spec: GarmentSpec }
  | { readonly ok: false; readonly issues: readonly string[] };

/** The id of the colourway a new design starts with. */
export const FIRST_COLOURWAY_ID = "main";
const FIRST_COLOURWAY_NAME = "Main colourway";
/** The id of the fabric a new design starts with. */
export const FIRST_FABRIC_ID = "main";
const FIRST_FABRIC_NAME = "Main fabric";

const EMPTY_LIST_MESSAGES: Readonly<Record<string, string>> = {
  fabrics: "Keep at least one fabric.",
  colourways: "Keep at least one colourway.",
};

/** A list that must not be empty fails as a missing first entry, so say it plainly. */
function friendlyIssues(input: unknown, issues: readonly { path: readonly PropertyKey[]; message: string }[]): string[] {
  const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return issues.map((issue) => {
    const [key, index] = issue.path;
    const emptyMessage = typeof key === "string" ? EMPTY_LIST_MESSAGES[key] : undefined;
    const list = typeof key === "string" ? record[key] : undefined;
    return emptyMessage && index === 0 && Array.isArray(list) && list.length === 0 ? emptyMessage : issue.message;
  });
}

/** Checks any input against the contract and the registry. Nothing is thrown. */
export function validateSpec(input: unknown): ValidationResult {
  const parsed = garmentSpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data };
  return { ok: false, issues: friendlyIssues(input, parsed.error.issues) };
}

/**
 * A valid starting design for a type: the default choice for every option, marked
 * derived because nobody chose it, no measurements, no sizing, one empty fabric, one
 * empty colourway and no artwork.
 */
export function createSpec(typeId: string, wearer: Wearer): SpecResult {
  const type = getType(typeId);
  if (!type) return { ok: false, reason: `There is no garment type called ${typeId}.` };
  const checked = validateSpec({
    schemaVersion: SPEC_SCHEMA_VERSION,
    typeId,
    wearer,
    options: Object.fromEntries(
      type.options.map((option) => [option.id, { choiceId: option.defaultChoice, provenance: "derived" }]),
    ),
    sizing: null,
    measurements: [],
    fabrics: [{ id: FIRST_FABRIC_ID, name: FIRST_FABRIC_NAME, ...EMPTY_FABRIC_DETAILS, provenance: "user-edited" }],
    panelFabrics: [],
    colourways: [{ id: FIRST_COLOURWAY_ID, name: FIRST_COLOURWAY_NAME, colours: [] }],
    artwork: [],
    components: [],
    construction: [],
    labelling: {},
  });
  return checked.ok ? checked : { ok: false, reason: checked.issues[0] ?? "That design is not valid." };
}
