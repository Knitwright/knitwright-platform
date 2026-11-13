import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Board } from "@/components/collections/Board";
import { LinePlanTable } from "@/components/collections/LinePlanTable";
import { PlanActions } from "@/components/collections/PlanActions";
import { StyleCard } from "@/components/collections/StyleCard";
import { StyleForm } from "@/components/collections/StyleForm";
import { TotalsBar } from "@/components/collections/TotalsBar";
import { TotalsPanel } from "@/components/collections/TotalsPanel";
import { ViewToggle } from "@/components/collections/ViewToggle";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { Icon } from "@/components/ui/Icon";
import { can } from "@/lib/clubs/roles";
import { linePlan } from "@/lib/collections/line-plan";
import { loadPlanView, loadStyleRender } from "@/lib/collections/server";
import type { Style } from "@/lib/collections/types";
import { styleFacts } from "@/lib/order-desk/plan-cards";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Collection plan" };

/**
 * One collection plan (09 screen 32, p12/p13; spec F-S10), moved from `/studio/collections/[id]`
 * (decision 0143). Board: one column per group, style cards with fabric, sizes, MOQ, target cost and
 * status, "+ Add style", and the navy totals bar. List: the line plan, which prices every line from the
 * factory tiers of decision 0071 at the whole plan's quantity. Each card's render streams in.
 */
export default async function CollectionPlanPage({ params, searchParams }: PageProps<"/orders/plan/[collectionId]">) {
  const { brand } = await requireMember();
  const { collectionId } = await params;
  const asked = (await searchParams).view;
  const view = asked === "list" || asked === "line-plan" ? "list" : "board";
  const found = await loadPlanView(await sessionClient(), brand.id, collectionId);
  if (found === null) notFound();
  const { plan, pricing, products } = found;
  const canEdit = can(brand.role, "manageKit");
  const lines = linePlan(plan, pricing);
  const rowOf = new Map(lines.rows.map((row) => [row.styleId, row]));
  const cards = Object.fromEntries(plan.styles.map((style) => [style.id, card(brand.id, style, plan.id, plan.currency, canEdit, styleFacts(rowOf.get(style.id), pricing[style.id]?.ladder ?? [], plan.currency, style.fabricCode))]));

  return (
    <div className="flex flex-col gap-6 pt-6">
      <Link href="/orders/plans" className="flex w-fit items-center gap-2 text-h3 font-medium text-text-2 no-underline live:hover:text-text">
        <Icon icon={ArrowLeft} size={20} />
        Orders
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 text-text">Collection plan · {plan.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle collectionId={plan.id} view={view} />
          <a href="#actions" className="inline-flex h-10 items-center rounded-md bg-navy px-4 text-body font-semibold text-on-dark no-underline live:hover:bg-navy-2">
            Order samples for approved styles
          </a>
        </div>
      </header>
      <p className="text-body text-muted">
        Landed in {plan.destinationCountry}, priced in {plan.currency}.
      </p>

      {view === "board" ? (
        <>
          <Board plan={plan} cards={cards} canEdit={canEdit} />
          <TotalsBar totals={lines.totals} currency={plan.currency} />
          <TotalsPanel plan={plan} />
        </>
      ) : (
        <LinePlanTable plan={plan} pricing={pricing} canEdit={canEdit} />
      )}

      <div id="actions">
        <PlanActions plan={plan} canEdit={canEdit} />
      </div>
      <div id="add-style">
        <StyleForm plan={plan} products={products.map((product) => ({ id: product.id, name: product.name }))} canEdit={canEdit} />
      </div>
    </div>
  );
}

function card(brandId: string, style: Style, collectionId: string, currency: string, canEdit: boolean, facts: ReturnType<typeof styleFacts>) {
  return (
    <StyleCard
      key={style.id}
      style={style}
      collectionId={collectionId}
      canEdit={canEdit}
      currency={currency}
      facts={facts}
      art={
        <Suspense fallback={<GarmentOutline />}>
          <Render brandId={brandId} style={style} />
        </Suspense>
      }
    />
  );
}

/** The render of the design behind a style card, or the outline where there is none. */
async function Render({ brandId, style }: Readonly<{ brandId: string; style: Style }>) {
  const render = await loadStyleRender(await sessionClient(), brandId, style.projectId);
  if (render === null) return <GarmentOutline />;
  return (
    // A data address made on the server, shown as a picture so nothing in it can run. The card names the style, so the render is decoration.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={render.src} alt="" title={render.label} className="h-32 w-auto max-w-full object-contain" />
  );
}
