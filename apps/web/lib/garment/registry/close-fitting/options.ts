import type { OptionDefinition, Rule } from "../../definitions";

/** The questions a designer answers about a singlet, vest, sports bra or compression top. */
export const CLOSE_FITTING_OPTIONS: readonly OptionDefinition[] = [
  {
    id: "fit",
    label: "Fit",
    choices: [
      { id: "regular", label: "Regular" },
      { id: "slim", label: "Slim" },
      { id: "relaxed", label: "Relaxed" },
    ],
    defaultChoice: "regular",
  },
  {
    id: "sleeves",
    label: "Sleeves",
    choices: [
      { id: "sleeveless", label: "No sleeves" },
      { id: "short", label: "Short sleeves" },
      { id: "long", label: "Long sleeves" },
    ],
    defaultChoice: "sleeveless",
  },
  {
    id: "back-style",
    label: "Back",
    choices: [
      { id: "straight", label: "Straight back", help: "The straps run straight over the shoulders." },
      { id: "racerback", label: "Racerback", help: "The straps meet between the shoulder blades, leaving the shoulders free." },
    ],
    defaultChoice: "straight",
  },
  {
    id: "edge-finish",
    label: "Edge finish",
    help: "How the neck and armhole edges are finished.",
    choices: [
      { id: "bound", label: "Bound edges", help: "A strip of fabric is folded over each edge and sewn on." },
      { id: "turned", label: "Turned and stitched", help: "Each edge is turned under and stitched down." },
      { id: "elastic", label: "Elastic edges", help: "Elastic is sewn into each edge so it lies close to the body." },
    ],
    defaultChoice: "bound",
  },
  {
    id: "underband",
    label: "Underband",
    help: "The band round the bottom edge of a sports bra that holds it in place.",
    choices: [
      { id: "exposed-elastic", label: "Exposed elastic", help: "The elastic band shows on the outside, and may carry a woven logo." },
      { id: "covered-elastic", label: "Covered elastic", help: "The elastic is enclosed in a band of fabric." },
    ],
    defaultChoice: "covered-elastic",
  },
  {
    id: "seam-type",
    label: "Seams",
    choices: [
      { id: "overlock", label: "Overlocked seams", help: "The usual seams of knitwear, with a small ridge inside." },
      { id: "flatlock", label: "Flat seams", help: "Seams sewn flat with no ridge inside, so nothing rubs against the skin." },
    ],
    defaultChoice: "overlock",
  },
];

/**
 * Combinations of choices that cannot be made. Only add a rule when the combination is
 * truly impossible, not when it is unusual.
 */
export const CLOSE_FITTING_RULES: readonly Rule[] = [
  {
    id: "racerback-has-no-sleeves",
    when: [
      { option: "back-style", in: ["racerback"] },
      { option: "sleeves", in: ["short", "long"] },
    ],
    reason: "A racerback leaves the shoulders free, so there is nowhere to sew a sleeve. Choose a straight back, or no sleeves.",
  },
];
