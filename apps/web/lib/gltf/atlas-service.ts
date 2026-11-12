import { currentStack } from "@/lib/artwork-stack";
import { baseArticleForType } from "@/lib/catalogue";
import { draftForEditor, modelForDraft } from "@/lib/editor/draft";
import type { FormValues } from "@/lib/editor/slots";
import type { GarmentSpec } from "@/lib/garment";
import { toGradedPattern } from "@/lib/parametric";
import type { PrintContext } from "@/lib/print/inputs/context";
import { panelPictures, picturesForViewer } from "./panel-pictures";

/** The platform's own version of the block, as `modelForDraft` records it. */
const BLOCK_VERSION = 1;

export interface AtlasRequest {
  readonly size: string;
  readonly colourwayId: string | null;
  readonly form: FormValues;
}

/**
 * The panel pictures for the 3D view of one saved design version: drafted from the same form the
 * editor drafts its model from (so the islands are the same ones), and painted from that version's
 * print files. An empty record when the design has no model, so the viewer keeps the flat-drape form.
 */
export async function atlasForDesign(
  spec: GarmentSpec,
  context: Pick<PrintContext, "profile" | "rules" | "assets">,
  request: AtlasRequest,
): Promise<Record<string, string>> {
  const code = spec.article?.baseArticleCode ?? baseArticleForType(spec.typeId) ?? null;
  const draft = draftForEditor(code, request.size, request.form);
  const model = modelForDraft(draft);
  if (draft?.kind !== "drafted" || !model) return {};
  const stack = currentStack(spec);
  const asked = stack.colourways.find((one) => one.id === request.colourwayId);
  const pictures = await panelPictures({
    pattern: toGradedPattern([draft.draft], BLOCK_VERSION),
    layout: model.layout,
    stack,
    colourwayId: asked?.id ?? stack.colourways[0]?.id ?? "main",
    garment: spec.typeId,
    profile: context.profile,
    rules: context.rules,
    assets: context.assets,
  });
  return picturesForViewer(pictures);
}
