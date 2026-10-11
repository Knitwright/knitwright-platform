import { getType, type GarmentSpec } from "@/lib/garment";

/**
 * The garments a person can pick for a NEW design during the beta (decision 0027). The
 * Platform and Store Guide (pages 6 and 7) launches with jerseys, shorts, singlets, training
 * tees, hoodies, track jackets and polos; leggings, sports bras and compression tops wait for
 * the second wave. To offer one, add its id here: this list is the only switch.
 *
 * A garment left out keeps all its code. Designs already made in it still open, edit, and
 * give a tech pack and every export.
 */
export const LAUNCH_GARMENTS: readonly string[] = [
  // Tops.
  "crew-tee",
  "v-neck-tee",
  "long-sleeve-tee",
  "polo",
  "team-jersey",
  // Bottoms.
  "shorts",
  "joggers",
  "track-pants",
  // Outerwear.
  "pullover-hoodie",
  "zip-hoodie",
  "track-jacket",
  // Close-fitting.
  "singlet",
  "vest",
];

const OFFERED: ReadonlySet<string> = new Set(LAUNCH_GARMENTS);

/** True when a new design may start as this garment type. */
export const isOffered = (typeId: string): boolean => OFFERED.has(typeId);

/** The plain answer when someone asks for a garment that is not offered yet. */
export const notOfferedReason = (typeId: string): string => `Not offered yet: ${getType(typeId)?.label ?? typeId}.`;

/** The part of a change that matters here. Every change of garment type has this shape. */
type TypeChange = Readonly<{ type: string; typeId?: string }>;

/**
 * The reason a batch of changes is refused because it turns the design into a garment that
 * is not offered, or null. A design that already is such a garment may stay one.
 */
export function notOfferedChange(spec: GarmentSpec, actions: readonly TypeChange[]): string | null {
  const refused = actions.find(
    (action) => action.type === "change-type" && action.typeId !== undefined && action.typeId !== spec.typeId && !isOffered(action.typeId),
  );
  return refused?.typeId === undefined ? null : notOfferedReason(refused.typeId);
}
