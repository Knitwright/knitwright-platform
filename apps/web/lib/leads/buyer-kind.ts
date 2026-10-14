import { z } from "zod";
import { BUYER_KINDS, type BuyerKind } from "./buyer-kinds";

export { BUYER_KINDS, type BuyerKind };

/** The answer to the first question of the guided start, checked on the server. */
const IDS = BUYER_KINDS.map((kind) => kind.id) as [BuyerKind, ...BuyerKind[]];

export const buyerKindSchema = z.enum(IDS, "Choose which path fits you first.");

export const buyerKindLabel = (id: string | null): string =>
  BUYER_KINDS.find((kind) => kind.id === id)?.label ?? "Not given";

const BY_ORGANISATION: Readonly<Record<string, BuyerKind>> = {
  club: "team_kit",
  school: "team_kit",
  gym: "team_kit",
  event: "team_kit",
  brand: "launch_brand",
};

/**
 * The path to tick before the person chooses: the one the brand took before, else the one its
 * type of organisation (asked on the welcome page) usually takes. Empty when neither is known.
 */
export const defaultBuyerKind = (
  brand: Readonly<{ organisationType: string | null; segment: BuyerKind | null }>,
): BuyerKind | "" => {
  if (brand.segment) return brand.segment;
  const type = brand.organisationType ?? "";
  return Object.hasOwn(BY_ORGANISATION, type) ? BY_ORGANISATION[type] : "";
};
