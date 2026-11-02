import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { OpsOrder } from "../rows";
import type { InvoiceArticle, InvoiceDestination, InvoiceFactory, InvoiceSource } from "./model";

/**
 * The rows a commercial invoice is built from. Each read answers null where nothing is on file, and the model
 * then names the gap on the document; none of them invents a value.
 *
 * `base_articles` and `country_rules` are catalogue data every signed-in member may read, so the person's own
 * client reads them. `factories` is reachable only by the server's own key.
 */

const articleRow = z.object({ code: z.string(), name: z.string(), hs_code: z.string().nullable(), origin: z.string().nullable() });

/** The catalogue article an ops order was made as, found by the registry type the order names. */
export async function articleForOrder(client: Pick<SupabaseClient, "from">, registryTypeId: string): Promise<InvoiceArticle | null> {
  const { data } = await client.from("base_articles").select("code, name, hs_code, origin").eq("registry_type_id", registryTypeId).limit(1).maybeSingle();
  const parsed = articleRow.safeParse(data);
  return parsed.success ? { code: parsed.data.code, name: parsed.data.name, hsCode: parsed.data.hs_code, origin: parsed.data.origin } : null;
}

const factoryRow = z.object({ name: z.string(), city: z.string(), country: z.string() });

/** The factory the order names, by slug. Null: not on file, and the invoice cannot say where the goods were made. */
export async function factoryForOrder(admin: Pick<SupabaseClient, "from">, slug: string): Promise<InvoiceFactory | null> {
  const { data } = await admin.from("factories").select("name, city, country").eq("slug", slug).limit(1).maybeSingle();
  const parsed = factoryRow.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const countryRow = z.object({ country: z.string(), name: z.string(), preference_scheme: z.string().nullable() });

/** The destination's own rule row. Null: that country has no rules on file, so no scheme is claimed. */
export async function destinationRule(client: Pick<SupabaseClient, "from">, country: string): Promise<InvoiceDestination | null> {
  const { data } = await client.from("country_rules").select("country, name, preference_scheme").eq("country", country).limit(1).maybeSingle();
  const parsed = countryRow.safeParse(data);
  return parsed.success ? { country: parsed.data.country, name: parsed.data.name, preferenceScheme: parsed.data.preference_scheme } : null;
}

/** Every country an invoice may name, for the form's own list. */
export async function listDestinations(client: Pick<SupabaseClient, "from">): Promise<readonly InvoiceDestination[]> {
  const { data } = await client.from("country_rules").select("country, name, preference_scheme").order("name").limit(100);
  return z.array(countryRow).safeParse(data).data?.map((r) => ({ country: r.country, name: r.name, preferenceScheme: r.preference_scheme })) ?? [];
}

export interface SourceInput {
  readonly order: OpsOrder;
  readonly brandName: string;
  readonly destinationCountry: string;
  readonly issuedOn: string;
  readonly incoterms: string;
}

/** Gathers everything the invoice needs, in one place, so the model stays pure. */
export async function loadInvoiceSource(
  client: Pick<SupabaseClient, "from">,
  admin: Pick<SupabaseClient, "from">,
  input: SourceInput,
): Promise<InvoiceSource> {
  const [article, factory, destination] = await Promise.all([
    articleForOrder(client, input.order.articleId),
    factoryForOrder(admin, input.order.factoryProfileId),
    destinationRule(client, input.destinationCountry),
  ]);
  return {
    order: {
      id: input.order.id,
      externalRef: input.order.externalRef,
      pieces: input.order.pieces,
      sizes: input.order.sizes,
      valueMinor: input.order.valueMinor,
      currency: input.order.currency,
      articleId: input.order.articleId,
      factoryProfileId: input.order.factoryProfileId,
    },
    brandName: input.brandName,
    article,
    factory,
    destination,
    issuedOn: input.issuedOn,
    incoterms: input.incoterms,
  };
}
