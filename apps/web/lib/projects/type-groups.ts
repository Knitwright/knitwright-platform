import { listFamilies, listTypes } from "@/lib/garment";

export type TypeGroup = Readonly<{
  label: string;
  options: readonly { readonly id: string; readonly label: string }[];
}>;

/** Every garment type the registry has, grouped by the label of its family. Empty families are left out. */
export const garmentTypeGroups = (): readonly TypeGroup[] =>
  listFamilies()
    .map((family) => ({
      label: family.label,
      options: listTypes(family.id).map((type) => ({ id: type.id, label: type.label })),
    }))
    .filter((group) => group.options.length > 0);
