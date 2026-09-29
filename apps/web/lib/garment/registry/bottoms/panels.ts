import type { PanelDefinition } from "../../definitions";
import { when } from "../shared";

/**
 * The parts of a pair of bottoms that can each have their own colour. Both legs are one
 * panel on each side, as they are cut and coloured together. Only the legs carry artwork.
 */
export const BOTTOMS_PANELS: readonly PanelDefinition[] = [
  {
    id: "legs-front",
    label: "Front of the legs",
    appliesWhen: [],
    anchors: [
      { id: "left-thigh", label: "Left thigh, the wearer's left" },
      { id: "right-thigh", label: "Right thigh, the wearer's right" },
      { id: "left-lower-leg", label: "Left lower leg, the wearer's left" },
      { id: "right-lower-leg", label: "Right lower leg, the wearer's right" },
    ],
  },
  {
    id: "legs-back",
    label: "Back of the legs",
    appliesWhen: [],
    anchors: [
      { id: "centre-back-waist", label: "Centre back, below the waistband" },
      { id: "left-back-thigh", label: "Back of the left thigh" },
      { id: "right-back-thigh", label: "Back of the right thigh" },
    ],
  },
  { id: "waistband", label: "Waistband", appliesWhen: [], anchors: [] },
  { id: "gusset", label: "Gusset", appliesWhen: [when("gusset", ["crotch-gusset"])], anchors: [] },
  { id: "side-stripes", label: "Side stripes", appliesWhen: [when("side-stripe", ["contrast-stripe"])], anchors: [] },
  { id: "cuffs", label: "Cuffs", appliesWhen: [when("leg-finish", ["rib-cuff"])], anchors: [] },
];
