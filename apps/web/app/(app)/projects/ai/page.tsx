import { Sparkles } from "lucide-react";
import type { Metadata, Route } from "next";
import { CreationFilters } from "@/components/projects/v3/CreationFilters";
import { CreationsMasonry } from "@/components/projects/v3/Creations";
import { EmptyList } from "@/components/projects/v3/States";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { filterFromQuery, visibleCreations } from "@/lib/projects-page/creations";
import { loadCreations } from "@/lib/projects-page/load";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "AI Creations" };

/** AI Creations (d06): the brand's AI pictures as a masonry, filtered from the address. */
export default async function AiCreationsPage({ searchParams }: PageProps<"/projects/ai">) {
  const { brand } = await requireMember();
  const filter = filterFromQuery((await searchParams).show);
  const creations = await loadCreations(await sessionClient(), brand.id);
  const shown = visibleCreations(creations, filter);

  return (
    <>
      <h1 className="text-h2 text-text md:sr-only">AI Creations</h1>
      <CreationFilters current={filter} />
      {shown.length > 0 ? (
        <CreationsMasonry creations={shown} />
      ) : (
        <EmptyList
          icon={<Icon icon={Sparkles} size={22} />}
          title={creations.length === 0 ? "No AI pictures yet" : "None of your AI pictures is of this kind"}
          action={creations.length === 0 ? <LinkButton href={"/launch" as Route}>Open a launch pack</LinkButton> : undefined}
        >
          <p>Scenes you shoot on a launch canvas, with your garment locked, and lifestyle pictures of your designs appear here.</p>
        </EmptyList>
      )}
    </>
  );
}
