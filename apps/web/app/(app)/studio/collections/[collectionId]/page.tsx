import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Board } from "@/components/collections/Board";
import { LinePlanTable } from "@/components/collections/LinePlanTable";
import { PlanActions } from "@/components/collections/PlanActions";
import { StyleCard } from "@/components/collections/StyleCard";
import { StyleForm } from "@/components/collections/StyleForm";
import { TotalsPanel } from "@/components/collections/TotalsPanel";
import { ViewToggle } from "@/components/collections/ViewToggle";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { PageIntro } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { loadPlanView, loadStyleRender } from "@/lib/collections/server";
import type { Style } from "@/lib/collections/types";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Collection plan" };

/**
 * One collection plan (spec F-S10): the board with its dotted canvas, frames and style cards and the
 * right-hand totals panel, or the line plan table, toggled from the top. Both are the same plan: the
 * table prices every line from the factory tiers of decision 0071 at the whole plan's quantity.
 *
 * The page is sent as soon as the plan is read; each card's render fills in when it is ready.
 */
export default async function CollectionPlanPage({ params, searchParams }: PageProps<"/studio/collections/[collectionId]">) {
  const { brand } = await requireMember();
  const { collectionId } = await params;
  const view = (await searchParams).view === "line-plan" ? "line-plan" : "board";
  const client = await sessionClient();
  const found = await loadPlanView(client, brand.id, collectionId);
  if (found === null) notFound();
  const { plan, pricing, products } = found;
  const canEdit = can(brand.role, "manageKit");

  const cards = Object.fromEntries(
    plan.styles.map((style) => [
      style.id,
      <StyleCard
        key={style.id}
        style={style}
        currency={plan.currency}
        art={
          <Suspense fallback={<GarmentOutline />}>
            <Render brandId={brand.id} style={style} />
          </Suspense>
        }
      />,
    ]),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageIntro
          eyebrow={`${brand.name} · collection plan`}
          title={plan.name}
          lead={`Landed in ${plan.destinationCountry}, priced in ${plan.currency}.`}
        />
        <ViewToggle collectionId={plan.id} view={view} />
      </div>

      {view === "board" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Board plan={plan} cards={cards} />
          <TotalsPanel plan={plan} />
        </div>
      ) : (
        <LinePlanTable plan={plan} pricing={pricing} canEdit={canEdit} />
      )}

      <PlanActions plan={plan} canEdit={canEdit} />
      <StyleForm plan={plan} products={products.map((product) => ({ id: product.id, name: product.name }))} canEdit={canEdit} />
    </div>
  );
}

/** The render of the design behind a style card, or the outline where there is none. */
async function Render({ brandId, style }: Readonly<{ brandId: string; style: Style }>) {
  const render = await loadStyleRender(await sessionClient(), brandId, style.projectId);
  if (render === null) return <GarmentOutline />;
  return (
    // A data address made on the server, shown as a picture so nothing in it can run. The card names the style, so the render is decoration.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={render.src} alt="" title={render.label} className="h-24 w-auto max-w-full object-contain" />
  );
}
