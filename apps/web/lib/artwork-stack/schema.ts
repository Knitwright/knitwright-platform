import { z } from "zod";
import { viewIdSchema } from "./anchors";
import { blendProblems } from "./blend";
import { stackColourSchema, stackColourwaySchema } from "./colours";
import { colourIdsOf, layerSchema } from "./layers";

/** The version this code writes and reads. A stack from a newer version is refused, never guessed at. */
export const ARTWORK_STACK_VERSION = 1;

export const NEWER_STACK_SENTENCE =
  "This artwork was saved by a newer version of Knitwright than this one, so it is not opened. Nothing was changed.";

const MAX_LAYERS = 64;
const MAX_COLOURS = 48;

const versionSchema = z.literal(ARTWORK_STACK_VERSION, { error: NEWER_STACK_SENTENCE });

const structureSchema = z
  .object({
    schemaVersion: versionSchema,
    /** The views this design covers. */
    views: z.array(viewIdSchema).min(1).max(5).readonly(),
    /** The colour list: each colour's id, role, screen colour and the codes a person typed. */
    colours: z.array(stackColourSchema).max(MAX_COLOURS).readonly(),
    /** Bottom to top: the order is the blend order. */
    layers: z.array(layerSchema).max(MAX_LAYERS).readonly(),
    /** Never empty. A colourway maps colour ids to colours. */
    colourways: z.array(stackColourwaySchema).min(1, "Keep at least one colourway.").readonly(),
    /** Set when the older fields were used to make this stack, and by which version of the design. */
    derivedFrom: z.object({ specVersion: z.number().int().min(0) }).readonly().optional(),
  })
  .readonly();

const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

/** Cross checks no single field can make: ids are unique, and everything a layer names exists. */
export const artworkStackSchema = structureSchema
  .unwrap()
  .superRefine((stack, context) => {
    const fail = (message: string, path: (string | number)[]): void => context.addIssue({ code: "custom", message, path });
    const colourIds = new Set(stack.colours.map((entry) => entry.id));
    if (!unique(stack.views)) fail("Each view can be listed only once.", ["views"]);
    if (!unique(stack.colours.map((entry) => entry.id))) fail("Each colour can be listed only once.", ["colours"]);
    if (!unique(stack.layers.map((entry) => entry.id))) fail("Each layer needs its own id.", ["layers"]);
    if (!unique(stack.colourways.map((entry) => entry.id))) fail("Each colourway needs its own id.", ["colourways"]);
    stack.layers.forEach((layer, at) => {
      if (!unique(layer.views)) fail("Each view can be listed only once.", ["layers", at, "views"]);
      const outside = layer.views.find((view) => !stack.views.includes(view));
      if (outside !== undefined) fail(`Layer ${layer.id} is on the ${outside} view, which this design does not have.`, ["layers", at, "views"]);
      const missing = colourIdsOf(layer).find((id) => !colourIds.has(id));
      if (missing !== undefined) fail(`Layer ${layer.id} uses a colour (${missing}) that is not in the colour list.`, ["layers", at]);
    });
    stack.colourways.forEach((colourway, at) => {
      const missing = Object.keys(colourway.colours).find((id) => !colourIds.has(id));
      if (missing !== undefined) fail(`Colourway ${colourway.id} names a colour (${missing}) that is not in the colour list.`, ["colourways", at]);
    });
    for (const text of blendProblems(stack.layers)) fail(text, ["layers"]);
  })
  .readonly();
export type ArtworkStack = z.output<typeof artworkStackSchema>;

export type StackResult =
  | { readonly ok: true; readonly stack: ArtworkStack }
  | { readonly ok: false; readonly reason: string };

/** Reads a stack from stored JSON. A newer version, or anything malformed, is refused with one plain sentence. */
export function parseArtworkStack(input: unknown): StackResult {
  const version = typeof input === "object" && input !== null ? (input as { schemaVersion?: unknown }).schemaVersion : undefined;
  if (typeof version === "number" && version > ARTWORK_STACK_VERSION) return { ok: false, reason: NEWER_STACK_SENTENCE };
  const parsed = artworkStackSchema.safeParse(input);
  return parsed.success ? { ok: true, stack: parsed.data } : { ok: false, reason: parsed.error.issues[0]?.message ?? "This artwork is not valid." };
}
