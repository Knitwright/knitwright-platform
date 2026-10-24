import type { OptionDefinition, Rule } from "../../definitions";

/** The questions teamwear adds to the ones tops and bottoms already ask. */

export const ELBOW_PADS: OptionDefinition = {
  id: "elbow-pads",
  label: "Elbow pads",
  help: "Padding built into the sleeve at the elbow, as on a goalkeeper shirt.",
  choices: [
    { id: "none", label: "No elbow pads" },
    { id: "padded-elbows", label: "Padded elbows", help: "A pad sits inside each sleeve at the elbow." },
  ],
  defaultChoice: "none",
};

export const SOCK_HEIGHT: OptionDefinition = {
  id: "sock-height",
  label: "Sock height",
  choices: [
    { id: "knee-high", label: "Knee high", help: "The sock reaches up to just below the knee." },
    { id: "crew", label: "Crew", help: "The sock reaches up the calf, well below the knee." },
  ],
  defaultChoice: "knee-high",
};

export const SOCK_TOP: OptionDefinition = {
  id: "sock-top",
  label: "Top of the sock",
  choices: [
    { id: "plain", label: "Plain top" },
    { id: "contrast-band", label: "Contrast band", help: "A band of a different colour round the top of the sock." },
  ],
  defaultChoice: "plain",
};

export const CAP_SHAPE: OptionDefinition = {
  id: "cap-shape",
  label: "Cap shape",
  choices: [
    { id: "peaked-cap", label: "Peaked cap", help: "A rounded crown with a stiff peak at the front." },
    { id: "baggy-cap", label: "Baggy cap", help: "A soft, loose crown that sits wider than the head band, with a peak at the front." },
  ],
  defaultChoice: "peaked-cap",
};

export const CAP_ADJUSTER: OptionDefinition = {
  id: "cap-adjuster",
  label: "Back adjuster",
  choices: [
    { id: "none", label: "No adjuster", help: "The cap is fitted and has no strap." },
    { id: "back-strap", label: "Strap at the back", help: "A strap across the back of the cap adjusts the fit." },
  ],
  defaultChoice: "none",
};

/**
 * The sport of the Australian winter code article. The partner has not picked a code, so the
 * only choice says so. The owner adds the code here when it is picked.
 */
export const WINTER_CODE: OptionDefinition = {
  id: "winter-code",
  label: "Sport",
  help: "The winter code this top is made for.",
  choices: [{ id: "not-chosen", label: "Code not chosen yet", help: "The partner has not picked the winter code, so none is offered." }],
  defaultChoice: "not-chosen",
};

export const KEEPER_RULES: readonly Rule[] = [
  {
    id: "padded-elbows-need-long-sleeve",
    when: [
      { option: "elbow-pads", in: ["padded-elbows"] },
      { option: "sleeve-length", in: ["short"] },
    ],
    reason: "Elbow pads sit at the elbow, which a short sleeve does not cover. Choose a long sleeve, or no elbow pads.",
  },
];
