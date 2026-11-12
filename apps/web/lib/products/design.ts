import { z } from "zod";
import type { BaseArticle } from "@/lib/catalogue/types";
import { ARTICLE_CODE } from "@/lib/catalogue/vocabulary";
import { WEARERS, type Wearer } from "@/lib/garment";
import type { OptionCodeMapping } from "@/lib/option-codes";
import { AppError } from "@/lib/server/core/errors";
import { checkChoices, registryChoicesFor } from "./configurator";

/** The chosen option codes, by group: `{ collar: "C01" }`. */
export const chosenOptionsSchema = z.record(z.string().regex(/^[a-z][a-z_]{0,39}$/), z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/));

/**
 * "Design this" and CREATE MY DESIGN (09 screens 11 and 28): a new design on this base, with the options chosen in
 * the configurator, opened in the editor. Before P4 the product page's button was a link to the blank new-design
 * form, which asked for the garment all over again and carried no option.
 *
 * The flow is written over ports so a unit test runs it; `actions.ts` joins it to the database. The design is made
 * the way the new-design form makes one (`createProject`), then the chosen options are applied as one version with
 * the editor's own batch save, so the editor shows them and one undo takes them back.
 */

export const designFromBaseSchema = z.object({
  code: z.string().regex(ARTICLE_CODE, "That is not a product code."),
  wearer: z.enum(WEARERS, "Choose who it is for."),
  options: chosenOptionsSchema.default({}),
});

export type DesignFromBase = z.output<typeof designFromBaseSchema>;

export interface DesignPorts {
  readonly article: (code: string) => Promise<BaseArticle | null>;
  readonly optionMap: (code: string) => Promise<readonly OptionCodeMapping[]>;
  readonly create: (input: Readonly<{ typeId: string; wearer: Wearer; name: string }>) => Promise<string>;
  /** Applies the options to version 1. Resolves to a reason when the save was refused, or null. */
  readonly applyOptions: (projectId: string, actions: readonly unknown[]) => Promise<string | null>;
  readonly warn: (message: string) => void;
}

export const NO_GARMENT_YET = "This base has no garment in the editor yet, so a design cannot start from it. It is coming in a later release.";

/** Makes the design and returns its id. Refuses an unknown base, a locked option, or a base with no garment. */
export async function designFromBase(input: DesignFromBase, ports: DesignPorts): Promise<string> {
  const article = await ports.article(input.code);
  if (!article) throw new AppError("not_found", "That product is not in the catalogue.");
  const check = checkChoices(article, input.options);
  if (!check.ok) throw new AppError("invalid_input", check.reason);
  if (article.registryTypeId === null) throw new AppError("invalid_input", NO_GARMENT_YET);

  const id = await ports.create({ typeId: article.registryTypeId, wearer: input.wearer, name: article.name });
  const choices = registryChoicesFor(await ports.optionMap(article.code), input.options);
  if (choices.length > 0) {
    const actions = choices.map((choice) => ({ type: "set-option", ...choice, provenance: "user-edited" }));
    const refused = await ports.applyOptions(id, actions);
    // The design exists either way; the editor opens on it and its Options panel still offers every choice.
    if (refused !== null) ports.warn(`The chosen options were not applied to ${id}: ${refused}`);
  }
  return id;
}
