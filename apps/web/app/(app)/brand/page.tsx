import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ProductsPanel } from "@/components/brand-runs/ProductsPanel";
import { RunBuilder } from "@/components/brand-runs/RunBuilder";
import { RunHistory } from "@/components/brand-runs/RunHistory";
import { PageIntro } from "@/components/shell/PageIntro";
import { PageSection } from "@/components/shell/PageSection";
import { loadRunContext } from "@/lib/brand-runs/run-context";
import { listProducts } from "@/lib/brand-runs/service";
import { can, ROLE_LABELS } from "@/lib/clubs/roles";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Brand" };

const DESIGNS_SHOWN = 100;
const query = z.object({ product: z.uuid().optional().catch(undefined) });

export default async function BrandPage({ searchParams }: PageProps<"/brand">) {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const selected = query.parse(await searchParams).product ?? null;
  const [products, designs] = await Promise.all([listProducts(client, brand.id), listProjects(client, brand.id, DESIGNS_SHOWN)]);
  const listed = new Set(products.map((p) => p.projectId));
  const choices = designs.projects.filter((d) => !listed.has(d.id)).map((d) => ({ id: d.id, label: d.name }));
  const product = products.find((p) => p.id === selected) ?? null;
  const context = product ? await loadRunContext(client, brand.id, product.projectId) : null;
  const canEdit = can(brand.role, "manageKit");

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`Brand · you are ${ROLE_LABELS[brand.role].toLowerCase()}`}
        title={brand.name}
        lead="Your products, a paid sample first, then a run of 50 to 300 pieces with a size breakdown. Prices come from the factory; where none is set, Knitwright will quote."
      />

      <PageSection id="products" title="Product list" description="A product is a design you plan to make. It starts as an idea, moves to sample when a sample is ordered, and to run when you are happy with the sample.">
        <ProductsPanel products={products} designs={choices} canEdit={canEdit} selectedId={selected} />
      </PageSection>

      <PageSection id="builder" title="Run builder" description="Pieces per size. Each quantity is compared with the design's size run and the factory's minimum order as you type.">
        {product && context ? (
          <RunBuilder key={product.id + product.stage} product={product} context={context} canEdit={canEdit} />
        ) : (
          <p className="text-[15px] text-muted">Choose a product above to plan a sample or a run. <Link href="/club" className="soft-link text-cobalt-soft">Club kit and rosters</Link> work the same way.</p>
        )}
      </PageSection>

      <PageSection id="sent" title="Sent to ops" description="Each sample and run, and where its order is. Read only.">
        <RunHistory products={products} />
      </PageSection>
    </div>
  );
}
