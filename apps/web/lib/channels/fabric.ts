import { AppError } from "@/lib/server/core/errors";

export const NO_FABRIC = "Name the fabric this product is made in.";
export const UNKNOWN_FABRIC = "Choose one of the fabrics the factory lists.";

/**
 * The fabric orders are made in, as the brand workspace's run builder decides it: one of the profile's listed
 * fabrics (the first when none is named), or, where the profile lists none, the one the brand names.
 */
export function fabricFor(listed: readonly string[], asked: string | null): string {
  const named = asked?.trim() ?? "";
  if (listed.length > 0) {
    if (named === "") return listed[0]!;
    if (!listed.includes(named)) throw new AppError("invalid_input", UNKNOWN_FABRIC);
    return named;
  }
  if (named === "") throw new AppError("invalid_input", NO_FABRIC);
  return named;
}
