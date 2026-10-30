import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseArticle, listBaseArticles, type BaseArticle, type BaseArticleSummary } from "@/lib/catalogue";
import { toDesignObjectV2 } from "@/lib/design-object";
import { getProject } from "@/lib/projects/project-reads";
import { articleOf } from "@/lib/validation/spec-input";
import { catalogueFrom } from "@/lib/validation/live-ports";
import { applyPlan, type ApplyPlan } from "./apply";
import { compareView, type CompareView, type StoredCard } from "./compare";
import { designAround, type DesignAroundReport } from "./design-around";
import { designShapeFrom } from "./shape";
import type { BenchmarkDetail, BenchmarkStore, Who } from "./store";

/**
 * What one benchmark screen reads. It joins the comparison to the catalogue and, when the comparison is tied to a
 * design, to that design's own shape, so the design-around check has something real to compare. Every piece is
 * optional: a comparison with no design shows no design-around check, and an article nobody chose shows no plan,
 * rather than the screen guessing at either.
 */

export type BenchmarkScreen = Readonly<{
  benchmark: BenchmarkDetail;
  compare: CompareView;
  articles: readonly BaseArticleSummary[];
  /** The article the person chose to map features onto, and the plan for each card against it. */
  article: BaseArticle | null;
  plans: readonly Readonly<{ cardId: string; plan: ApplyPlan }>[];
  /** One report per card, when the comparison is tied to a design whose object could be made. */
  designAround: readonly Readonly<{ cardId: string; report: DesignAroundReport }>[];
}>;

/** The design's shape, or null when there is no design, no article on file, or an object the format cannot hold. */
async function shapeOfDesign(client: SupabaseClient, who: Who, projectId: string | null) {
  if (projectId === null) return null;
  const design = await getProject(client, who.brandId, projectId);
  const ref = await articleOf(design.spec, catalogueFrom(client));
  const object = toDesignObjectV2(design.spec, { article: ref });
  if (!object.ok) return null;
  const article = ref === null ? null : await getBaseArticle(client, ref.baseArticleCode);
  return designShapeFrom(object.object, article);
}

const plansFor = (cards: readonly StoredCard[], article: BaseArticle | null) =>
  article === null ? [] : cards.map((card) => ({ cardId: card.id, plan: applyPlan(card.card, article) }));

export async function loadBenchmark(
  client: SupabaseClient,
  store: BenchmarkStore,
  who: Who,
  input: Readonly<{ benchmarkId: string; articleCode: string | null }>,
): Promise<BenchmarkScreen | null> {
  const benchmark = await store.read(who, input.benchmarkId);
  if (benchmark === null) return null;
  const [articles, article, shape] = await Promise.all([
    listBaseArticles(client),
    input.articleCode === null ? Promise.resolve(null) : getBaseArticle(client, input.articleCode),
    shapeOfDesign(client, who, benchmark.projectId).catch(() => null),
  ]);
  return {
    benchmark,
    compare: compareView(benchmark.cards),
    articles,
    article,
    plans: plansFor(benchmark.cards, article),
    designAround:
      shape === null ? [] : benchmark.cards.map((card) => ({ cardId: card.id, report: designAround(shape, card.card) })),
  };
}
