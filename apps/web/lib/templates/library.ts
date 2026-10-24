import { getType } from "@/lib/garment";
import type { TemplateSummary } from "./filters";

export type ArticleChoice = Readonly<{ id: string; label: string }>;

/** The garments that have at least one template, by name, for the garment filter. */
export function articleChoices(all: readonly TemplateSummary[]): readonly ArticleChoice[] {
  const ids = [...new Set(all.map((template) => template.articleId))];
  return ids
    .map((id) => ({ id, label: getType(id)?.label ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}
