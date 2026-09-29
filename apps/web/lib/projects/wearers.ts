import { WEARERS, type Wearer } from "@/lib/garment";

/** "women" is shown as "Women". */
export const wearerLabel = (wearer: Wearer): string => `${wearer.charAt(0).toUpperCase()}${wearer.slice(1)}`;

/** Who a design is made for, as the new design form lists it. */
export const WEARER_OPTIONS: readonly { readonly id: Wearer; readonly label: string }[] = WEARERS.map((id) => ({
  id,
  label: wearerLabel(id),
}));
