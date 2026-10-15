import { COLOUR_SYSTEM_LABELS, resolveColour, type ArtworkStack } from "@/lib/artwork-stack";
import type { ColourStandard } from "./input";

const named = (id: string): string => {
  const words = id.replaceAll("-", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

/**
 * The colour list of a stack in one colourway, as colour standards. Each keeps its role and screen colour; its codes are
 * exactly what a person typed, with the system they named. The factory code is the code typed under "factory"; a Pantone
 * or RAL code is shown as typed and is never read as a factory code. Knitwright ships no Pantone data.
 */
export function coloursOfStack(stack: ArtworkStack, colourwayId: string | undefined): ColourStandard[] {
  const wanted = colourwayId ?? stack.colourways[0]?.id;
  return stack.colours.map((colour, index) => {
    const value = resolveColour(stack, wanted, colour.id);
    const codes = value?.codes ?? [];
    return {
      id: `C${index + 1}`,
      role: colour.role,
      name: named(colour.id),
      factoryCode: codes.find((code) => code.system === "factory")?.value ?? null,
      screenColour: value?.screen ?? null,
      avoidAcceptedBy: null,
      typedCodes: codes.filter((code) => code.system !== "factory").map((code) => ({ system: COLOUR_SYSTEM_LABELS[code.system], value: code.value })),
    };
  });
}
