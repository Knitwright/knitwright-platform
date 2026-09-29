import type { Rule } from "../../definitions";

/**
 * Combinations of choices that cannot be made or sewn. Each carries a plain reason.
 * Only add a rule when the combination is truly impossible, not when it is unusual.
 */
export const TOPS_RULES: readonly Rule[] = [
  {
    id: "polo-collar-needs-placket",
    when: [
      { option: "collar", in: ["polo-collar"] },
      { option: "placket", in: ["none"] },
    ],
    reason: "A polo collar folds open at the front, so it needs a placket to fasten the opening.",
  },
  {
    id: "v-neck-has-no-placket",
    when: [
      { option: "neckline", in: ["v-neck"] },
      { option: "placket", in: ["buttons", "zip"] },
    ],
    reason: "A V neck already opens down the chest, so there is no room for a placket.",
  },
  {
    id: "v-neck-has-no-band-collar",
    when: [
      { option: "neckline", in: ["v-neck"] },
      { option: "collar", in: ["band-collar"] },
    ],
    reason: "A band collar stands up all the way round the neck, so it cannot sit on a V shaped opening.",
  },
];
