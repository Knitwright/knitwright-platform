import { getType } from "../registry";

export type Choices = Readonly<Record<string, string>>;

/** Every way of choosing one offered choice for each option of a type. Test support only. */
export function allCombinations(typeId: string): Choices[] {
  const type = getType(typeId);
  if (!type) return [];
  return type.options.reduce<Choices[]>(
    (partial, option) =>
      partial.flatMap((chosen) =>
        option.choices.map((choice) => ({ ...chosen, [option.id]: choice.id })),
      ),
    [{}],
  );
}
