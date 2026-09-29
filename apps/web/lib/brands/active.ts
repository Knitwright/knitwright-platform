import type { Brand } from "@/lib/server/core/guard";

/** The cookie that remembers which brand the user is working in, in this browser. */
export const ACTIVE_BRAND_COOKIE = "kw-brand";

/**
 * The brand the user is working in. `brands` is every brand they belong to, oldest
 * first, as the database reported it for this request. The pick comes from a cookie,
 * so it is only a preference: a brand that is not in the list is never chosen.
 */
export const chooseActiveBrand = (
  brands: readonly Brand[],
  pickedId: string | undefined,
): Brand | null => brands.find((brand) => brand.id === pickedId) ?? brands[0] ?? null;
