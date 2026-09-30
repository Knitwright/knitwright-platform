import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { resolveImageReading } from "@/lib/intent/image-input";
import { buildModelInput } from "@/lib/intent/model-input";
import { buildImageInput } from "@/lib/intent/image-input";
import { resolveIntent } from "@/lib/intent/resolve";
import { STAND_IN_SKETCH_TYPE, standInModels } from "./stand-in";

const ask = async (utterance: string, typeId = "crew-tee") => {
  const spec = start(typeId);
  const { primary } = standInModels();
  if (!primary) throw new Error("expected a stand-in model");
  const reply = await primary.provider.complete({ ...buildModelInput({ utterance, spec }), maxOutputTokens: 100 });
  return { spec, reply, utterance };
};

describe("the stand-in model for browser tests", () => {
  it("is a primary model with no retry, priced like the default model, and never reaches the network", () => {
    const models = standInModels();
    expect(models.primary?.provider.provider).toBe("stand-in");
    expect(models.retry).toBeNull();
  });

  it("reads the garment and choices a sentence names, as a model would, so the design changes", async () => {
    const { spec, reply, utterance } = await ask("A polo shirt for our club, slim fit with long sleeves");
    const outcome = resolveIntent({ utterance, spec, raw: reply.text });
    expect(outcome.kind).toBe("applied");
    if (outcome.kind !== "applied") return;
    expect(outcome.spec.typeId).toBe("polo");
    expect(outcome.spec.options.fit?.choiceId).toBe("slim");
    expect(outcome.spec.options["sleeve-length"]?.choiceId).toBe("long");
  });

  it("reads a garment of each family", async () => {
    for (const typeId of ["joggers", "zip-hoodie", "singlet"]) {
      const words = typeId.replace("-", " ");
      const { spec, reply, utterance } = await ask(`a ${words} for the team`);
      const outcome = resolveIntent({ utterance, spec, raw: reply.text });
      expect(outcome.kind === "applied" ? outcome.spec.typeId : outcome.kind, typeId).toBe(typeId);
    }
  });

  it("refuses, in words, a sentence that names nothing it knows", async () => {
    const { spec, reply, utterance } = await ask("hello there");
    expect(resolveIntent({ utterance, spec, raw: reply.text }).kind).toBe("rejection");
  });

  it("reads any picture as the same sketch, so the image path can be tested end to end", async () => {
    const spec = start("crew-tee");
    const { primary } = standInModels();
    const reply = await primary!.provider.complete({
      ...buildImageInput(spec),
      image: { mediaType: "image/png", base64: "AAAA" },
      maxOutputTokens: 100,
    });
    const outcome = resolveImageReading({ spec, raw: reply.text });
    expect(outcome.kind === "proposal" ? outcome.spec.typeId : outcome.kind).toBe(STAND_IN_SKETCH_TYPE);
  });
});
