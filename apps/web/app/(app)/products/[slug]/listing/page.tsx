import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingEditor } from "@/components/storefront/ListingEditor";
import { garmentEditorHref } from "@/lib/canvas/address";
import { can } from "@/lib/clubs/roles";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import { loadListingEditor } from "@/lib/storefront/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Listing" };

/**
 * The listing editor (plan v6 C3, decision 0154; 09 screen 23 `/products/:id/listing`; prototype p06). The id is a
 * brand product's; `/products/<code>` stays the catalogue's product page. A product of another brand, or no product,
 * is not found. A viewer sees the listing and cannot change it.
 */
export default async function ListingPage({ params }: PageProps<"/products/[slug]/listing">) {
  const { brand } = await requireMember();
  const { slug } = await params;
  const data = await loadListingEditor(await sessionClient(), brand, slug);
  if (data === null) notFound();
  return (
    <ListingEditor
      listing={data.listing}
      productName={data.product.name}
      editDesignHref={garmentEditorHref(data.product.projectId)}
      sizes={data.sizes}
      fabrics={data.fabrics}
      cost={data.cost}
      facts={{ stage: data.product.stage, hasRelease: data.hasRelease, productionClass: data.productionClass, euResponsiblePerson: data.storefront?.euResponsiblePerson ?? null, storefrontLive: data.storefront?.status === "live" }}
      gpsr={data.gpsr}
      pool={data.pool}
      sources={data.sources}
      canEdit={can(brand.role, "manageKit")}
      improvePrice={CREDIT_SETTINGS.prices.marketing_media}
    />
  );
}
