import { z } from "zod";

/**
 * The first question of the guided start (Platform and Store Guide, module 1): which path fits.
 * A design keeps the answer, and a brand takes the first one as its segment.
 */
export const BUYER_KINDS = [
  { id: "team_kit", label: "Team kit", hint: "Kit for a club, school or team." },
  { id: "launch_brand", label: "Launch a brand", hint: "Clothing to sell under your own label." },
  { id: "creator_merch", label: "Creator merch", hint: "Merch for your followers or fans." },
  { id: "upload_design", label: "Upload my design", hint: "You have a design and want it made." },
] as const;

export type BuyerKind = (typeof BUYER_KINDS)[number]["id"];

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
