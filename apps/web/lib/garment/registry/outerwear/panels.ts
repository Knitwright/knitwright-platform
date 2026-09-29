import type { PanelDefinition } from "../../definitions";
import { when } from "../shared";

/**
 * The parts of a hoodie or track jacket that can each have their own colour. As on a top,
 * only the body and sleeves carry artwork.
 */
export const OUTERWEAR_PANELS: readonly PanelDefinition[] = [
  {
    id: "body-front",
    label: "Body front",
    appliesWhen: [],
    anchors: [
      { id: "centre-chest", label: "Centre chest" },
      { id: "left-chest", label: "Left chest, the wearer's left" },
      { id: "right-chest", label: "Right chest, the wearer's right" },
      { id: "lower-front", label: "Lower front" },
    ],
  },
  {
    id: "body-back",
    label: "Body back",
    appliesWhen: [],
    anchors: [
      { id: "upper-back", label: "Upper back" },
      { id: "centre-back", label: "Centre back" },
      { id: "lower-back", label: "Lower back" },
    ],
  },
  { id: "sleeve-left", label: "Left sleeve", appliesWhen: [], anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }] },
  { id: "sleeve-right", label: "Right sleeve", appliesWhen: [], anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }] },
  { id: "hood", label: "Hood", appliesWhen: [when("hood", ["single-layer", "lined"])], anchors: [] },
  { id: "hood-lining", label: "Hood lining", appliesWhen: [when("hood", ["lined"])], anchors: [] },
  { id: "collar", label: "Collar", appliesWhen: [when("collar", ["stand-collar"])], anchors: [] },
  { id: "neckband", label: "Neckband", appliesWhen: [when("collar", ["none"])], anchors: [] },
  { id: "kangaroo-pocket", label: "Kangaroo pocket", appliesWhen: [when("pockets", ["kangaroo"])], anchors: [] },
  { id: "cuffs", label: "Cuffs", appliesWhen: [when("cuffs", ["rib-cuff"])], anchors: [] },
  { id: "hem-band", label: "Hem band", appliesWhen: [when("hem-finish", ["rib-band"])], anchors: [] },
];
