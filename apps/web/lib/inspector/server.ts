import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { EMPTY_BOOK } from "@/lib/home/book";
import { priceBook } from "@/lib/home/reads";
import { getProject } from "@/lib/projects/service";
import { readValidationResults } from "@/lib/validation/results";
import { garmentInspector } from "./garment";
import type { GarmentInspectorView } from "./types";

/**
 * Joins the garment inspector to the database (plan v6 E3, decision 0147). It holds no rules of its
 * own (`garment.ts` has them and is tested): it reads the design at its current version through the
 * member's own client, so row level security decides what is seen; the base article; the stored
 * validation result of that version, as the editor reads it; and the factory's price book, which only
 * the server's key may read (decision 0071).
 *
 * A catalogue or a price book that cannot be read never stops the inspector opening: the sections
 * that need them say so. A design that cannot be read is null.
 */

export interface InspectorAsk {
  readonly colourwayId?: string;
  readonly options?: Readonly<Record<string, string>>;
}

/** Prices are shown in pounds until the market switch reaches the editor (`08` shows £ throughout). */
const CURRENCY = "GBP" as const;

export async function loadGarmentInspector(client: SupabaseClient, brandId: string, designId: string, ask: InspectorAsk = {}): Promise<GarmentInspectorView | null> {
  const project = await getProject(client, brandId, designId).catch(() => null);
  if (project === null) return null;
  const code = project.spec.article?.baseArticleCode ?? baseArticleForType(project.spec.typeId) ?? null;
  const [article, results, book] = await Promise.all([
    code ? getBaseArticle(client, code).catch(() => null) : Promise.resolve(null),
    readValidationResults(client, brandId, designId, project.currentVersion).catch(() => []),
    priceBook().catch(() => EMPTY_BOOK),
  ]);
  return garmentInspector({
    designId,
    name: project.name,
    version: project.currentVersion,
    spec: project.spec,
    article,
    checks: results[0]?.checks ?? [],
    price: code ? book.source(code) : { ladder: [], moq: null },
    currency: CURRENCY,
    factory: { name: book.factoryName, leadTimeDays: code ? (book.capability(code)?.leadTimeDays ?? null) : null },
    colourwayId: ask.colourwayId,
    options: ask.options,
  });
}
