import type { Metadata } from "next";
import { AddFabricForm } from "@/components/production/fabrics/FabricForms";
import { FabricList } from "@/components/production/fabrics/FabricLibrary";
import { SizeMapTable } from "@/components/production/fabrics/SizeMapTable";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { loadFabricLibrary } from "@/lib/fabrics/library";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Fabrics and sizes" };

export default async function FabricsPage() {
  const { brand, userId } = await requireMember();
  const library = await loadFabricLibrary(await sessionClient(), adminClient(), { brandId: brand.id, userId });

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={brand.name}
        title="Fabrics and sizes"
        lead="The fabrics you make with, what is known about how they stretch and shrink, and which pattern size each size label is cut from. A number with no test behind it is shown as not set, and nothing is scaled for it."
      />

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
