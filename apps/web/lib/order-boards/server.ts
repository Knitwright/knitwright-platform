import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { isLinkedKind, type BoardView, type Graph } from "@/lib/launch";
import { listOrdersOfProjects } from "@/lib/order-desk/service";
import { getProject } from "@/lib/projects/project-reads";
import { TECH_PACK_PAGES } from "@/lib/techpack/exports/pages";
import { marksOf } from "@/lib/techpack/view/marks";
import { buildTechPackView } from "@/lib/techpack/view/model";
import { linkedDesignOf } from "./canvas";
import { orderSummary, techPackSummary } from "./summary";
import type { OrderBoardsData, OrderStateSummary, TechPackSummary } from "./types";

/**
 * Joins the Tech pack and Order boards to the database (plan v6 E4, decision 0148). It holds no
 * rules of its own -- `summary.ts` and `canvas.ts` have those and are tested -- and every read is the
 * member's own client, so row level security decides what is seen. A read that fails leaves its
 * board saying so; it never stops the canvas opening.
 */

const designsLinkedBy = (graph: Graph, kind: BoardView["kind"]): readonly string[] => [
  ...new Set(
    graph.boards
      .filter((board) => board.kind === kind && isLinkedKind(board.kind))
      .map((board) => linkedDesignOf(graph, board))
      .filter((id): id is string => id !== null),
  ),
];

/** The tech pack view the editor's tab draws, reduced to what a board shows. */
async function techPackOf(client: SupabaseClient, brandId: string, designId: string): Promise<TechPackSummary | null> {
  const project = await getProject(client, brandId, designId).catch(() => null);
  if (project === null) return null;
  const code = baseArticleForType(project.garmentType) ?? null;
  const article = code === null ? null : await getBaseArticle(client, code).catch(() => null);
  const sizes = article?.sizeRange ?? [];
  const view = buildTechPackView({
    spec: project.spec,
    article,
    header: { styleName: project.name, formName: null, brand: null, collection: null, season: null, factory: null },
    size: article?.sampleSize ?? sizes[0] ?? "",
    sizes,
    colourwayId: project.spec.colourways[0]?.id ?? "",
    marks: marksOf(project.spec),
    extras: [],
    unit: "mm",
    mode: "measurement",
  });
  return techPackSummary({
    designProjectId: designId,
    designName: project.name,
    version: project.currentVersion,
    pages: TECH_PACK_PAGES,
    counts: view.counts,
    review: view.review,
  });
}

async function ordersOf(client: SupabaseClient, brandId: string, designIds: readonly string[]): Promise<Readonly<Record<string, OrderStateSummary | null>>> {
  const orders = await listOrdersOfProjects(client, brandId, designIds).catch(() => null);
  if (orders === null) return {};
  return Object.fromEntries(designIds.map((id) => [id, orderSummary(orders.filter((order) => order.projectId === id))]));
}

export async function loadOrderBoards(
  client: SupabaseClient,
  member: Readonly<{ brandId: string; brandName: string; canOrder: boolean }>,
  graph: Graph,
): Promise<OrderBoardsData> {
  const techIds = designsLinkedBy(graph, "tech_pack");
  const [techPacks, orders] = await Promise.all([
    Promise.all(techIds.map(async (id) => [id, await techPackOf(client, member.brandId, id)] as const)).then((pairs) => Object.fromEntries(pairs)),
    ordersOf(client, member.brandId, designsLinkedBy(graph, "order")),
  ]);
  return { brandName: member.brandName, canOrder: member.canOrder, techPacks, orders };
}
