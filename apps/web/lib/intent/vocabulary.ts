/**
 * Words that name a garment type, an option choice or a wearer outright. The ambiguity
 * rules use them to decide whether a person asked for a change or a model inferred it.
 * Phrases are written in lower case with spaces; the matcher treats hyphens, apostrophes
 * and punctuation the same way. A longer phrase wins over a shorter one inside it, so
 * "polo collar" names a collar and not a polo shirt.
 *
 * The tops words are here; each other family has its own file (`words-<family>.ts`). Every
 * list is a proposal, to be checked with the golden sets (owner action A7).
 */
import { BOTTOMS_WORDS } from "./words-bottoms";
import { CLOSE_FITTING_WORDS } from "./words-close-fitting";
import { OUTERWEAR_WORDS } from "./words-outerwear";
import type { FamilyWords, Table } from "./words";

interface VocabularyEntry {
  readonly phrase: string;
  /** A target key made by `typeTarget`, `choiceTarget` or `wearerTarget`. */
  readonly target: string;
}

const TYPES: Table = {
  "crew-tee": ["crew neck tee", "crew neck t shirt", "crew neck tshirt", "crewneck tee", "crewneck t shirt", "crew tee", "crew t shirt"],
  "v-neck-tee": ["v neck tee", "v neck t shirt", "v neck tshirt", "vneck tee", "vneck t shirt", "v tee"],
  "long-sleeve-tee": [
    "long sleeve tee",
    "long sleeved tee",
    "long sleeve t shirt",
    "long sleeved t shirt",
    "long sleeve tshirt",
    "longsleeve tee",
    "longsleeve",
  ],
  polo: ["polo shirt", "polo shirts", "polo", "polos"],
  "team-jersey": [
    "team jersey",
    "jersey",
    "jerseys",
    "football shirt",
    "football jersey",
    "soccer jersey",
    "soccer shirt",
    "rugby shirt",
    "sports jersey",
    "match shirt",
    "kit shirt",
  ],
};

const CHOICES: Readonly<Record<string, Table>> = {
  fit: {
    regular: ["regular fit", "standard fit", "classic fit", "regular"],
    slim: ["slim fit", "slim", "fitted", "tighter", "athletic fit", "skinny fit"],
    relaxed: ["relaxed fit", "relaxed", "loose", "looser", "oversized", "baggy", "roomy", "roomier", "boxy"],
  },
  neckline: {
    crew: ["crew neck", "crewneck", "crew neckline", "round neck", "round neckline"],
    "v-neck": ["v neck", "vneck", "v neckline", "v shaped neck"],
  },
  collar: {
    none: [
      "no collar",
      "collarless",
      "without a collar",
      "without collar",
      "remove the collar",
      "remove collar",
      "take off the collar",
      "drop the collar",
      "lose the collar",
      "get rid of the collar",
    ],
    "polo-collar": ["polo collar", "polo style collar", "fold over collar", "folded collar"],
    "band-collar": ["band collar", "stand collar", "stand up collar", "mandarin collar", "grandad collar"],
  },
  placket: {
    none: [
      "no placket",
      "without a placket",
      "remove the placket",
      "remove placket",
      "drop the placket",
      "no buttons",
      "remove the buttons",
      "no zip",
      "remove the zip",
    ],
    buttons: ["button placket", "buttoned placket", "buttons", "button", "buttoned"],
    zip: ["zip placket", "quarter zip", "zip", "zipper", "zipped"],
  },
  "sleeve-type": {
    "set-in": ["set in sleeves", "set in sleeve", "set in"],
    raglan: ["raglan sleeves", "raglan sleeve", "raglan"],
  },
  "sleeve-length": {
    short: ["short sleeves", "short sleeve", "short sleeved"],
    long: ["long sleeves", "long sleeve", "long sleeved", "full sleeves", "full length sleeves"],
  },
  "hem-shape": {
    straight: ["straight hem", "straight across", "flat hem", "straight bottom"],
    curved: ["curved hem", "curved", "shirt tail hem", "shirttail hem", "tail hem", "drop tail hem"],
    "side-vent": ["side vents", "side vent", "side splits", "side slits", "vented hem", "split hem"],
  },
  "side-panels": {
    none: [
      "no side panels",
      "without side panels",
      "remove the side panels",
      "remove side panels",
      "no contrast strips",
      "remove the side stripes",
      "no side stripes",
    ],
    "contrast-insert": [
      "contrast side panels",
      "side panels",
      "contrast strips",
      "side stripes",
      "contrast panels",
      "contrast inserts",
      "side inserts",
    ],
  },
  cuffs: {
    none: ["no cuffs", "without cuffs", "remove the cuffs", "remove cuffs", "hemmed sleeves", "plain hemmed sleeves"],
    "rib-cuff": ["ribbed cuffs", "rib cuffs", "cuffs", "cuffed sleeves", "ribbed sleeve ends"],
  },
};

const WEARERS: Table = {
  men: ["men", "mens", "man", "male", "guys"],
  women: ["women", "womens", "woman", "womans", "ladies", "female"],
  youth: ["youth", "kids", "kid", "children", "childrens", "junior", "juniors", "boys", "girls"],
};

export const typeTarget = (typeId: string): string => `type:${typeId}`;
export const choiceTarget = (optionId: string, choiceId: string): string => `choice:${optionId}:${choiceId}`;
export const wearerTarget = (wearer: string): string => `wearer:${wearer}`;

const entries = (table: Table, target: (id: string) => string): VocabularyEntry[] =>
  Object.entries(table).flatMap(([id, phrases]) => phrases.map((phrase) => ({ phrase, target: target(id) })));

const TOPS_WORDS: FamilyWords = { types: TYPES, choices: CHOICES };

/** The words of every family, tops first. */
const FAMILY_WORDS: readonly FamilyWords[] = [TOPS_WORDS, BOTTOMS_WORDS, OUTERWEAR_WORDS, CLOSE_FITTING_WORDS];

const familyEntries = ({ types, choices }: FamilyWords): VocabularyEntry[] => [
  ...entries(types, typeTarget),
  ...Object.entries(choices).flatMap(([optionId, table]) => entries(table, (choiceId) => choiceTarget(optionId, choiceId))),
];

/** The target for player names and numbers (decision 0027). Not a family word: every family with a place for them uses it. */
const MARKS_TARGET = "marks:names-numbers";

const MARKS_PHRASES: readonly string[] = [
  "names and numbers",
  "name and number",
  "names and numbers on the back",
  "name and number on the back",
  "player names and numbers",
  "player name and number",
  "player names",
  "player numbers",
  "team names and numbers",
];

export const VOCABULARY: readonly VocabularyEntry[] = [
  ...FAMILY_WORDS.flatMap(familyEntries),
  ...entries(WEARERS, wearerTarget),
  ...MARKS_PHRASES.map((phrase) => ({ phrase, target: MARKS_TARGET })),
];

/** Words that, just before a phrase, mean the person does not want it. */
export const NEGATORS: readonly string[] = ["not", "dont", "no", "never", "without", "instead", "rather", "except", "nor"];
