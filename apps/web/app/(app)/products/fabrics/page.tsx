import type { Metadata } from "next";
import { AddFabricForm } from "@/components/production/fabrics/FabricForms";
import { FabricList } from "@/components/production/fabrics/FabricLibrary";
import { SizeMapTable } from "@/components/production/fabrics/SizeMapTable";
import { ProductsHeader } from "@/components/products/ProductsHeader";
import { PageSection } from "@/components/shell/PageSection";
import { loadFabricLibrary } from "@/lib/fabrics/library";
import { FABRICS_PATH } from "@/lib/products/routes";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Fabrics and sizes" };

/**
 * The Fabrics tab of Products (plan v6 P4, decision 0142), moved from `/brands/fabrics` with its behaviour kept:
 * the brand's fabrics with their tests, the add-a-fabric form, and the size labels and pattern sizes.
 */
export default async function FabricsPage() {
  const { brand, userId } = await requireMember();
  const library = await loadFabricLibrary(await sessionClient(), adminClient(), { brandId: brand.id, userId });

  return (
    <div className="flex flex-col gap-8 pb-16">
      <ProductsHeader title="Fabrics and sizes" current={FABRICS_PATH} />
      <p className="max-w-180 text-body text-text-2">
        The fabrics you make with, what is known about how they stretch and shrink, and which pattern size each size label is cut from. A number with no test behind it is
        shown as not set, and nothing is scaled for it.
      </p>

      <PageSection
        id="fabrics"
        title="Your fabrics"
        description="Stretch and shrink come from fabric tests. A test names who ran it, when and how, and is never changed afterwards."
      >
        <FabricList fabrics={library.fabrics} />
      </PageSection>

      <PageSection id="add-fabric" title="Add a fabric" description="Fill in only what your supplier's sheet states. Leave the rest empty.">
        <AddFabricForm />
      </PageSection>

      <PageSection
        id="size-labels"
        title="Size labels and pattern sizes"
        description={
          <>
            <p>{library.sizeMapReadiness.sentence}</p>
            <p className="mt-2">
              Junior sizes 6 to 16 take their starter measurements from the nearest youth size by age. Women&rsquo;s 3XL has no
              starter measurements, because no published source gives them: type them in or import your own chart.
            </p>
          </>
        }
      >
        <SizeMapTable maps={library.sizeMaps} />
      </PageSection>
    </div>
  );
}
