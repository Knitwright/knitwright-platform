import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failureFromDatabase, type DatabaseError } from "@/lib/projects/database-errors";
import { AppError } from "@/lib/server/core/errors";
import { parseLeadRows, type LeadRow } from "./admin";
import { BUYER_KINDS, type BuyerKind } from "./buyer-kind";
import { missingDetails, storedDetails, type OrganisationDetails } from "./organisation";
import { firstAllowedDate, quoteStatusSchema, type QuoteRequestInput, type QuoteStatus } from "./quote";
import type { LeadOwner } from "./routing";

/**
 * Reads and writes for the lead engine. Members' reads and brand details go through the
 * person's own client, so the database decides what they reach. A design's buyer kind and a
 * quote request go through the server's own client and functions that check membership. Admin
 * reads and writes go through the person's own client, and the functions refuse anyone who is not
 * a platform admin.
 */

const BRAND_NOT_FOUND = "That brand does not exist.";

const failIf = (error: DatabaseError | null): void => {
  if (error) throw failureFromDatabase(error);
};

const brandDetailsRow = z.object({
  organisation_type: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  // An unknown segment reads as none rather than failing the page.
  segment: z.enum(BUYER_KINDS.map((kind) => kind.id) as [BuyerKind, ...BuyerKind[]]).nullable().catch(null),
});

export type BrandDetails = OrganisationDetails & Readonly<{ segment: BuyerKind | null }>;

export async function getBrandDetails(client: SupabaseClient, brandId: string): Promise<BrandDetails> {
  const { data, error } = await client
    .from("brands")
    .select("organisation_type, country, region, segment")
    .eq("id", brandId)
    .maybeSingle();
  failIf(error);
  if (!data) throw new AppError("not_found", BRAND_NOT_FOUND);
  const row = brandDetailsRow.parse(data);
  const details = storedDetails({
    organisationType: row.organisation_type,
    country: row.country,
    region: row.region,
  });
  return { ...details, segment: row.segment };
}

export async function setBrandDetails(
  client: SupabaseClient,
  brandId: string,
  details: OrganisationDetails,
): Promise<void> {
  const { error } = await client.rpc("set_brand_details", {
    p_brand_id: brandId,
    p_organisation_type: details.organisationType ?? "",
    p_country: details.country ?? "",
    p_region: details.region ?? "",
  });
  if (error?.code === "P0002") throw new AppError("not_found", BRAND_NOT_FOUND);
  failIf(error);
}

export async function setProjectBuyerKind(
  admin: SupabaseClient,
  input: Readonly<{ projectId: string; userId: string; buyerKind: BuyerKind }>,
): Promise<void> {
  const { error } = await admin.rpc("set_project_buyer_kind", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_buyer_kind: input.buyerKind,
  });
  failIf(error);
}

export async function requestQuote(
  admin: SupabaseClient,
  input: QuoteRequestInput & Readonly<{ userId: string }>,
): Promise<string> {
  const { data, error } = await admin.rpc("request_quote", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_version: input.version,
    p_quantity: input.quantity,
    p_needed_by: input.neededBy,
    p_sizes_note: input.sizesNote,
    p_message: input.message,
  });
  failIf(error);
  return z.uuid().parse(data);
}

export interface DesignQuote {
  readonly id: string;
  readonly version: number;
  readonly quantity: number;
  readonly neededBy: string;
  readonly status: QuoteStatus;
  readonly createdAt: string;
}

const designQuoteRow = z.object({
  id: z.uuid(),
  version: z.number().int(),
  quantity: z.number().int(),
  needed_by: z.string(),
  status: quoteStatusSchema,
  created_at: z.string(),
});

export const DESIGN_QUOTES_LISTED = 10;

/** The latest quote requests for one design of the brand, newest first. */
export async function listDesignQuotes(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
): Promise<DesignQuote[]> {
  const { data, error } = await client
    .from("quote_requests")
    .select("id, version, quantity, needed_by, status, created_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(DESIGN_QUOTES_LISTED);
  failIf(error);
  return z
    .array(designQuoteRow)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      version: row.version,
      quantity: row.quantity,
      neededBy: row.needed_by,
      status: row.status,
      createdAt: row.created_at,
    }));
}

/** Whether the signed-in person is a platform admin. False when anything goes wrong. */
export async function amPlatformAdmin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("am_platform_admin");
  return !error && data === true;
}

export async function loadLeadRows(client: SupabaseClient): Promise<LeadRow[]> {
  const { data, error } = await client.rpc("admin_lead_rows");
  failIf(error);
  return parseLeadRows(data);
}

export async function setLead(
  client: SupabaseClient,
  input: Readonly<{ brandId: string; owner: LeadOwner | null; nextStep: string; nextStepOn: string | null }>,
): Promise<void> {
  const { error } = await client.rpc("admin_set_lead", {
    p_brand_id: input.brandId,
    p_owner: input.owner ?? "",
    p_next_step: input.nextStep,
    p_next_step_on: input.nextStepOn,
  });
  if (error?.code === "P0002") throw new AppError("not_found", BRAND_NOT_FOUND);
  failIf(error);
}

export async function setQuoteStatus(
  client: SupabaseClient,
  input: Readonly<{ quoteId: string; status: QuoteStatus }>,
): Promise<void> {
  const { error } = await client.rpc("admin_set_quote_status", {
    p_quote_id: input.quoteId,
    p_status: input.status,
  });
  if (error?.code === "P0002") throw new AppError("not_found", "That quote request does not exist.");
  failIf(error);
}

export interface DesignLeads {
  readonly details: BrandDetails;
  /** Whether to ask for the organisation details beside the design. */
  readonly askDetails: boolean;
  readonly quotes: readonly DesignQuote[];
  /** The first needed-by date a quote request accepts. */
  readonly firstDate: string;
}

/** What a design's page needs for the organisation prompt and "Request a quote". */
export async function loadDesignLeads(
  client: SupabaseClient,
  brandId: string,
  projectId: string,
  now: Date,
): Promise<DesignLeads> {
  const [details, quotes] = await Promise.all([
    getBrandDetails(client, brandId),
    listDesignQuotes(client, brandId, projectId),
  ]);
  return { details, askDetails: missingDetails(details).length > 0, quotes, firstDate: firstAllowedDate(now) };
}
