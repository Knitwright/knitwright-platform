import { isOffered } from "@/lib/config/launch-garments";
import { listFamilies, listTypes } from "@/lib/garment";

export type TypeGroup = Readonly<{
  label: string;
  options: readonly { readonly id: string; readonly label: string }[];
}>;

/**
 * Every garment type a new design may start as, grouped by the label of its family. Types
 * not offered yet (lib/config/launch-garments) and empty families are left out.
 */
export const garmentTypeGroups = (): readonly TypeGroup[] =>
  listFamilies()
    .map((family) => ({
      label: family.label,
      options: listTypes(family.id)
        .filter((type) => isOffered(type.id))
        .map((type) => ({ id: type.id, label: type.label })),
    }))
    .filter((group) => group.options.length > 0);
