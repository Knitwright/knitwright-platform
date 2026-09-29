import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { Brand } from "@/lib/server/core/guard";
import { BRAND_NAME_MAX, MAX_BRANDS } from "./limits";

/**
 * Brands, as the signed-in user may see and change them. Every call goes through the
 * user's own client, so the database decides what they may reach.
 */

const NAME_RULE = `A brand name has 1 to ${BRAND_NAME_MAX} characters.`;
const LIMIT_REACHED = `You can belong to ${MAX_BRANDS} brands at most.`;
const NO_SUCH_BRAND = "That brand does not exist.";

export const brandNameSchema = z
  .string()
  .trim()
  .min(1, NAME_RULE)
  .max(BRAND_NAME_MAX, NAME_RULE);

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }>;

/** Postgres error codes the brand functions raise, and what they mean to the user. */
const brandFailureFrom = (error: DatabaseError): AppError => {
  if (error.hint === "brand_limit") return new AppError("conflict", LIMIT_REACHED);
  switch (error.code) {
    case "28000": // The function found no signed-in user.
    case "42501": // The caller may not run the function at all.
      return new AppError("unauthenticated", MESSAGES.unauthenticated);
    case "22023":
      return new AppError("invalid_input", MESSAGES.invalid_input, { name: [NAME_RULE] });
    case "P0002": // No such brand, or not the caller's.
    case "22P02": // The id is not an id.
      return new AppError("not_found", NO_SUCH_BRAND);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

const membershipRow = z.object({
  role: z.literal("owner"),
  brands: z.object({ id: z.uuid(), name: z.string() }),
});

/** Every brand the user belongs to, oldest membership first. */
export const listBrands = async (client: SupabaseClient): Promise<Brand[]> => {
  const { data, error } = await client
    .from("memberships")
    .select("role, created_at, brands (id, name)")
    .order("created_at", { ascending: true });
  if (error) throw brandFailureFrom(error);

  return z
    .array(membershipRow)
    .parse(data)
    .map(({ role, brands }) => ({ id: brands.id, name: brands.name, role }));
};

export const createBrand = async (client: SupabaseClient, name: string): Promise<Brand> => {
  const { data, error } = await client.rpc("create_brand", { p_name: name });
  if (error) throw brandFailureFrom(error);
  return { id: z.uuid().parse(data), name: name.trim(), role: "owner" };
};

export const renameBrand = async (
  client: SupabaseClient,
  brandId: string,
  name: string,
): Promise<void> => {
  const { error } = await client.rpc("rename_brand", { p_brand_id: brandId, p_name: name });
  if (error) throw brandFailureFrom(error);
};
