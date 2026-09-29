import { WEARERS, type Wearer } from "@/lib/garment";

const LABELS: Readonly<Record<Wearer, string>> = { men: "Men", women: "Women", youth: "Youth" };

export const wearerLabel = (wearer: Wearer): string => LABELS[wearer];

/** Who a design is made for, as the new design form lists it. */
export const WEARER_OPTIONS: readonly { readonly id: Wearer; readonly label: string }[] = WEARERS.map((id) => ({
  id,
  label: LABELS[id],
}));
