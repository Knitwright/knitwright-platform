import type { PanelDefinition } from "../../definitions";

/**
 * The parts of a top that can each have their own colour. Only the large body and
 * sleeve panels have anchors, so only they can carry artwork.
 */
export const TOPS_PANELS: readonly PanelDefinition[] = [
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
    appliesWhen: [],
    anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }],
  },
  {
    id: "sleeve-right",
    label: "Right sleeve",
    appliesWhen: [],
    anchors: [{ id: "sleeve-centre", label: "Middle of the sleeve" }],
  },
  {
    id: "neckband",
    label: "Neckband",
    appliesWhen: [{ option: "collar", in: ["none"] }],
    anchors: [],
  },
  {
    id: "collar",
    label: "Collar",
    appliesWhen: [{ option: "collar", in: ["polo-collar", "band-collar"] }],
    anchors: [],
  },
  {
    id: "placket",
    label: "Placket",
    appliesWhen: [{ option: "placket", in: ["buttons", "zip"] }],
    anchors: [],
  },
  {
    id: "side-panels",
    label: "Side panels",
    appliesWhen: [{ option: "side-panels", in: ["contrast-insert"] }],
    anchors: [],
  },
  {
    id: "cuffs",
    label: "Cuffs",
    appliesWhen: [{ option: "cuffs", in: ["rib-cuff"] }],
    anchors: [],
  },
];
