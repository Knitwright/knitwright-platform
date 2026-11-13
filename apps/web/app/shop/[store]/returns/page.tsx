import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { paragraphsOf } from "@/lib/storefront/policy";
import { loadShop } from "@/lib/storefront/server";

export const metadata: Metadata = { title: "Returns policy" };

/** A storefront's returns policy (spec F-L5 "Returns"), the brand's own words. Public, like the storefront. */
export default async function ShopReturnsPage({ params }: PageProps<"/shop/[store]/returns">) {
  const { store } = await params;
  const shop = await loadShop(store);
  if (shop === null) notFound();
  return (
    <ShopFrame name={shop.storefront.name} slug={shop.storefront.slug} accent={shop.accent}>
      <h1 className="text-h1 text-text">Returns policy</h1>
      <div className="flex max-w-180 flex-col gap-3">
        {paragraphsOf(shop.storefront.returnsPolicy).map((paragraph) => (
          <p key={paragraph} className="text-body-lg text-text-2">
            {paragraph}
          </p>
        ))}
      </div>
    </ShopFrame>
  );
}
