import { describe, expect, it } from "vitest";
import { createFakeAssetReader } from "@/lib/artwork-stack";
import { draftForEditor, modelForDraft } from "@/lib/editor/draft";
import { defaultForm } from "@/lib/editor/form";
import { jersey } from "@/lib/editor/fixtures/article";
import { createSpec, type GarmentSpec } from "@/lib/garment";
import { NO_RULES } from "@/lib/print/fixtures/setup";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles";
import { atlasForDesign } from "./atlas-service";

const context = { profile: DEFAULT_PRINT_PROFILE, rules: NO_RULES, assets: createFakeAssetReader([]) };

function spec(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

describe("atlasForDesign", () => {
  it("paints every island of the model the editor draws for a JSY-SS-01 design", async () => {
    const form = defaultForm(jersey());
    const pictures = await atlasForDesign(spec("team-jersey"), context, { size: "M", colourwayId: null, form });
    const model = modelForDraft(draftForEditor("JSY-SS-01", "M", form));

    expect(Object.keys(pictures).sort()).toEqual(model?.layout.panels.map((panel) => panel.id).sort());
    for (const src of Object.values(pictures)) expect(src).toMatch(/^data:image\/png;base64,/);
  });

  it("is nothing for a design with no drafted model, so the viewer keeps the form made from the flat", async () => {
    expect(await atlasForDesign(spec("polo"), context, { size: "M", colourwayId: null, form: { options: {}, parameters: {} } })).toEqual({});
  });

  it("is nothing for a form the article does not offer", async () => {
    const form = { options: {}, parameters: { body_length_offset: 500 } };
    expect(await atlasForDesign(spec("team-jersey"), context, { size: "M", colourwayId: null, form })).toEqual({});
  });
});
