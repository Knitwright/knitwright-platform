import type { PanelDefinition } from "../../definitions";
import { when } from "../shared";

/**
 * The parts of a close-fitting garment that can each have their own colour. As on a top,
 * only the body and sleeves carry artwork.
 */
export const CLOSE_FITTING_PANELS: readonly PanelDefinition[] = [
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
  {
    id: "sleeve-left",
    label: "Left sleeve",
    appliesWhen: [when("sleeves", ["short", "long"])],
    anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }],
  },
  {
    id: "sleeve-right",
    label: "Right sleeve",
    appliesWhen: [when("sleeves", ["short", "long"])],
    anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }],
  },
  { id: "binding", label: "Edge binding", appliesWhen: [when("edge-finish", ["bound"])], anchors: [] },
  { id: "underband", label: "Underband", appliesWhen: [when("underband", ["exposed-elastic", "covered-elastic"])], anchors: [] },
];
