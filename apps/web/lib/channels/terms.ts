import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRunContext } from "@/lib/brand-runs/run-context";
import { getProduct } from "@/lib/brand-runs/service";
import { baseArticleForType, getBaseArticle } from "@/lib/catalogue";
import { orderValidationGate } from "@/lib/make/order-gate";
import { guardOrder } from "@/lib/moderation/before-order";
import { humanReviewGate, orderGate } from "@/lib/moderation/server";
import { AppError } from "@/lib/server/core/errors";
import { moderationTargets } from "@/lib/validation/spec-input";
import type { OrderTerms } from "./push";
import { fabricFor } from "./fabric";
import { NOT_READY } from "./view";

/**
 * The terms a product is sold on through a channel (plan v6 C4, decision 0155): its newest frozen release, the
 * factory profile and the first fabric the profile lists for it, and the flags of the order gates — the D1
 * validation gate, the content screen and the F-G2 checklist — run now, with the person present, exactly as a run
 * from the brand workspace runs them (`lib/brand-runs/place-order.ts`). The database runs D1's gate again on every
 * order that later arrives, inside `submit_order_for_production`.
 */

export const NO_RELEASE = "This product has no frozen release to make yet. Freeze one from its tech pack first.";

export type ProductTerms = Readonly<{ projectId: string; name: string; sizes: readonly string[]; terms: OrderTerms }>;

export async function termsForProduct(
  clients: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>,
  who: Readonly<{ brandId: string; userId: string }>,
  brandName: string,
  productId: string,
  fabricAsked: string | null,
): Promise<ProductTerms> {
  const product = await getProduct(clients.client, who.brandId, productId);
  if (product.stage !== "run") throw new AppError("conflict", NOT_READY);
  const context = await loadRunContext(clients.client, who.brandId, product.projectId);
  const release = context.releases[0];
  if (!release) throw new AppError("conflict", NO_RELEASE);
  const fabricKey = fabricFor(context.fabrics, fabricAsked);

  const gate = orderValidationGate({ client: clients.client, admin: clients.admin, who, brandName, country: "GB" });
  const flags = await gate({ projectId: product.projectId, releaseId: release.id, productionClass: context.productionClass, colourToleranceMax: null }, async () =>
    (
      await guardOrder(
        { order: orderGate(who, "channel listing"), humanReview: humanReviewGate() },
        {
          releaseId: release.id,
          label: context.designName,
          assetIds: moderationTargets(context.spec).map((target) => target.id),
          texts: [{ text: context.designName, context: "title" }],
          classB: context.productionClass === "B",
        },
      )
    ).result,
  );

  const named = await clients.client.from("brand_products").select("name").eq("id", product.id).maybeSingle();
  return {
    projectId: product.projectId,
    name: typeof named.data?.name === "string" ? named.data.name : context.designName,
    sizes: context.sizeRun.length > 0 ? context.sizeRun : await articleSizes(clients.client, context.garmentType),
    terms: { releaseId: release.id, factoryProfileId: context.factoryProfileId, fabricKey, flags },
  };
}

/** The base article's size range, where the design names no size run of its own (as the make flow does). */
async function articleSizes(client: SupabaseClient, garmentType: string): Promise<readonly string[]> {
  const code = baseArticleForType(garmentType);
  if (!code) return [];
  return (await getBaseArticle(client, code))?.sizeRange ?? [];
}

