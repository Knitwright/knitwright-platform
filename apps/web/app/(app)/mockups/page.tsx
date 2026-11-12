import { Shirt } from "lucide-react";
import type { Metadata } from "next";
import { MockupsView } from "@/components/mockups/v3/MockupsView";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { categoryFromQuery } from "@/lib/mockups/gallery/categories";
import { cardsFor, colourwayFromQuery, designFromQuery } from "@/lib/mockups/gallery/cards";
import { productOnPage } from "@/lib/mockups/gallery/server";
import { loadMockupScenes } from "@/lib/mockups/service";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Mockups" };

/** How many of the brand's designs the "Use a product" menu lists, newest first. */
const PRODUCTS_LISTED = 50;

function NoProduct() {
  return (
    <>
      <h1 className="pt-4 text-h1 text-text">Mockups for every kit</h1>
      <EmptyState
        icon={<Icon icon={Shirt} size={22} />}
        title="Design a kit to see it in every scene"
        action={<LinkButton href="/studio/start">Create your first kit</LinkButton>}
        className="mt-10"
      >
        Every mockup here shows one of your own products, drawn by Knitwright. You have none yet.
      </EmptyState>
    </>
  );
}

/**
 * The mockup generator (09 screen 8, decision 0140): one of the brand's products in every scene of
 * the library. The free scenes download as files here; an AI scene, and a chart card, are made on a
 * launch canvas, which Edit opens with a mockup board on that scene.
 */
export default async function MockupsPage({ searchParams }: PageProps<"/mockups">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const client = await sessionClient();
  const { projects } = await listProjects(client, brand.id, PRODUCTS_LISTED);
  if (projects.length === 0) return <NoProduct />;

  const asked = designFromQuery(query.design);
  const design = projects.find((one) => one.id === asked) ?? projects[0]!;
  const category = categoryFromQuery(query.cat);
  const [product, library] = await Promise.all([productOnPage(client, brand.id, design.id, colourwayFromQuery(query.colourway)), loadMockupScenes(client)]);
  const cards = cardsFor(
    library.scenes.map((one) => one.scene),
    category,
  );

  return <MockupsView product={product} choices={projects.map((one) => ({ id: one.id, name: one.name }))} category={category} cards={cards} />;
}
