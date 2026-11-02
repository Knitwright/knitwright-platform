import type { ClubColours } from "@/lib/kit-styles/presets";
import { settleEverywhere, type TeamwearKit } from "./kit";
import { COLOURS_ROW } from "./rows";

/**
 * Kit bundle templates (spec F-T1 step 1, "article or kit bundle"): a shirt, shorts and a socks
 * colour in one press. A bundle arranges the club's own colours; it never invents one, and it holds
 * no structural value at all, so there is nothing here a factory has to approve.
 *
 * The goalkeeper bundle needs a third colour, because a keeper's shirt has to differ from both
 * outfield kits. A club with two colours is told so rather than given a colour nobody picked.
 */

export const KIT_BUNDLES = ["home", "away", "gk"] as const;
export type KitBundleId = (typeof KIT_BUNDLES)[number];

export interface BundleColours {
  /** The colours the whole kit is built from: the main colour, the second and an optional third. */
  readonly colours: ClubColours;
  readonly socksColour: string;
}

export interface KitBundle {
  readonly id: KitBundleId;
  readonly label: string;
  /** One short line under the tile, in the words the club reads. */
  readonly hint: string;
}

export const BUNDLES: readonly KitBundle[] = [
  { id: "home", label: "Home", hint: "Shirt, shorts and socks in your main colour, trimmed in your second." },
  { id: "away", label: "Away", hint: "Your second colour on the shirt, shorts and socks, trimmed in your main." },
  { id: "gk", label: "Goalkeeper", hint: "Your third colour throughout, so the keeper differs from both kits." },
];

export const bundleById = (id: string | null | undefined): KitBundle | undefined => BUNDLES.find((bundle) => bundle.id === id);

type BundleResult = Readonly<{ ok: true; colours: BundleColours }> | Readonly<{ ok: false; reason: string }>;

/** Why a goalkeeper bundle cannot be built from two colours. Shown instead of a made-up third colour. */
export const NEEDS_THIRD_COLOUR = "A goalkeeper kit needs a third colour, so the keeper differs from both outfield kits. Pick one first.";

/** The colours a bundle arranges from the club's own, or the reason it cannot. */
export function bundleColours(id: KitBundleId, club: ClubColours): BundleResult {
  if (id === "home") return { ok: true, colours: { colours: club, socksColour: club.main } };
  if (id === "away") {
    const swapped: ClubColours = { main: club.second, second: club.main, third: club.third };
    return { ok: true, colours: { colours: swapped, socksColour: club.second } };
  }
  if (club.third === null) return { ok: false, reason: NEEDS_THIRD_COLOUR };
  return { ok: true, colours: { colours: { main: club.third, second: club.main, third: club.second }, socksColour: club.third } };
}

/**
 * The kit with a bundle applied: the colours arranged, the socks colour set, and the colours row
 * settled on every part, so the pill row ticks the whole kit at once. That is what lets a club
 * finish a kit inside the spec's ninety seconds.
 */
export function applyBundle(
  kit: TeamwearKit,
  id: KitBundleId,
  club: ClubColours,
): Readonly<{ ok: true; kit: TeamwearKit }> | Readonly<{ ok: false; reason: string }> {
  const arranged = bundleColours(id, club);
  if (!arranged.ok) return arranged;
  const settled = settleEverywhere(kit, COLOURS_ROW);
  return {
    ok: true,
    kit: { ...settled, colours: arranged.colours.colours, socksColour: arranged.colours.socksColour, bundleId: id },
  };
}
