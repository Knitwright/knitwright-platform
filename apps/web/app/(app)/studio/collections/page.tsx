import type { Metadata, Route } from "next";
import Link from "next/link";
import { NewCollection } from "@/components/collections/NewCollection";
import { PageIntro } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { loadCollections, loadMarkets } from "@/lib/collections/server";
import { pieces, styleWord } from "@/lib/collections/vocabulary";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Collection plans" };

/**
 * The brand's collection plans (spec F-S10). A plan is a range: its styles, their colourways, their
 * sizes and the costs and margins that follow from the factory's own price tiers.
 *
 * Nothing on this page sells anything. "Create drop" inside a plan writes a payload for the Knitwright
 * Store to collect; this platform never takes a payment (owner decision 1).
 */
export default async function CollectionsPage() {
  const { brand } = await requireMember();
  const [plans, markets] = await Promise.all([loadCollections(await sessionClient(), brand.id), loadMarkets()]);
  const canEdit = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`${brand.name} · collections`}
        title="Collection plans"
        lead="Plan a whole range: the styles, the colourways, the sizes and the quantities. The line plan prices every line from Knitwright's own tiers, with freight and duty to the market you are landing in."
      />
      <NewCollection markets={markets} canEdit={canEdit} />

      {plans.length === 0 ? (
        <p className="text-[15px] text-muted">{brand.name} has no collection plan yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
          <table className="w-full min-w-[36rem] text-left text-[15px]">
            <caption className="sr-only">The collection plans of {brand.name}</caption>
            <thead>
              <tr className="border-b border-hairline text-sm text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                <th scope="col" className="px-4 py-3 font-medium">Landed in</th>
                <th scope="col" className="px-4 py-3 font-medium">Styles</th>
                <th scope="col" className="px-4 py-3 font-medium">Planned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link href={`/studio/collections/${plan.id}` as Route} className="soft-link text-cobalt-soft">
                      {plan.name}
                    </Link>
                  </th>
                  <td className="px-4 py-3 text-muted">
                    {plan.destinationCountry} · {plan.currency}
                  </td>
                  <td className="px-4 py-3 text-muted">{styleWord(plan.styles)}</td>
                  <td className="px-4 py-3 text-muted">{pieces(plan.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
