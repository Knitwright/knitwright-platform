import { catalogue } from "@/lib/catalogue/fixtures/source";
import type { BaseArticle } from "@/lib/catalogue";

/** TEST FIXTURE ONLY. The seeded catalogue, so the editor is tested against the rows the app really reads. */
export const seeded = (code: string): BaseArticle => {
  const found = catalogue().find((article) => article.code === code);
  if (!found) throw new Error(`No seeded article ${code}.`);
  return found;
};

/** The worked base article of the build pack: three collars, two sleeve finishes, three pattern fills, three ranges. */
export const jersey = (): BaseArticle => seeded("JSY-SS-01");

/** A launch article seeded as a draft: a code and a size range, and no options, ranges or construction. */
export const bare = (): BaseArticle => seeded("SHO-TR-01");

/** The same article with one option and one range signed off by a sample, for the "not yet sampled" cases. */
export function withSample(article: BaseArticle, optionCode: string, parameterKey: string): BaseArticle {
  const sampleId = "11111111-1111-4111-8111-111111111111";
  return {
    ...article,
    options: article.options.map((option) => (option.code === optionCode ? { ...option, approvedBySampleId: sampleId } : option)),
    parameters: article.parameters.map((def) => (def.key === parameterKey ? { ...def, approvedBySampleId: sampleId } : def)),
  };
}
