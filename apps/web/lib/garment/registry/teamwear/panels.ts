import type { PanelDefinition } from "../../definitions";
import { when } from "../shared";

/** The sock and cap parts that can each have their own colour. */

export const SOCK_PANELS: readonly PanelDefinition[] = [
  {
    id: "sock-leg",
    label: "Leg of the sock",
    appliesWhen: [],
    anchors: [
      { id: "shin", label: "Front of the leg, over the shin" },
      { id: "calf", label: "Back of the leg, over the calf" },
    ],
  },
  { id: "sock-foot", label: "Foot of the sock", appliesWhen: [], anchors: [] },
  { id: "sock-top-band", label: "Band at the top", appliesWhen: [when("sock-top", ["contrast-band"])], anchors: [] },
];

export const CAP_PANELS: readonly PanelDefinition[] = [
  {
    id: "cap-crown",
    label: "Crown",
    appliesWhen: [],
    anchors: [
      { id: "crown-front", label: "Front of the crown" },
      { id: "crown-back", label: "Back of the crown" },
    ],
  },
  { id: "cap-peak", label: "Peak", appliesWhen: [], anchors: [] },
  { id: "cap-band", label: "Head band", appliesWhen: [], anchors: [] },
];
