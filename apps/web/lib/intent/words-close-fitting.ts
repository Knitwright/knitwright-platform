import type { FamilyWords } from "./words";

/**
 * Words that name a close-fitting garment type or choice outright. A proposal written without
 * a garment professional, to be checked with the golden set (owner action A7). "Vest" means a
 * sleeveless top here, as in British English; "tank top" names it too.
 */
export const CLOSE_FITTING_WORDS: FamilyWords = {
  types: {
    singlet: ["singlet", "singlets", "running singlet", "racing singlet", "athletics singlet"],
    vest: ["vest", "vests", "vest top", "tank top", "tank"],
    "sports-bra": ["sports bra", "sports bras", "sport bra", "bra top", "training bra", "crop bra"],
    "compression-top": ["compression top", "compression shirt", "compression tee", "base layer", "baselayer", "base layer top"],
  },
  choices: {
    sleeves: {
      sleeveless: ["sleeveless", "no sleeves", "without sleeves", "remove the sleeves", "drop the sleeves"],
      short: ["short sleeves", "short sleeve", "short sleeved"],
      long: ["long sleeves", "long sleeve", "long sleeved", "full sleeves", "full length sleeves"],
    },
    "back-style": {
      straight: ["straight back", "standard back", "normal back", "straight straps", "no racerback"],
      racerback: ["racerback", "racer back", "racerback straps", "racer back straps"],
    },
    "edge-finish": {
      bound: ["bound edges", "bound edge", "binding", "bound neck", "bound armholes", "bias binding"],
      turned: ["turned edges", "turned edge", "turned and stitched", "turned hems", "folded edges", "hemmed edges"],
      elastic: ["elastic edges", "elastic edge", "elasticated edges", "elastic trim", "elastic neck and armholes"],
    },
    underband: {
      "exposed-elastic": ["exposed elastic", "exposed underband", "exposed band", "visible elastic", "logo elastic", "jacquard elastic"],
      "covered-elastic": ["covered elastic", "covered underband", "covered band", "enclosed elastic", "fabric covered elastic"],
    },
    "seam-type": {
      overlock: ["overlock", "overlocked", "overlock seams", "overlocked seams", "serged seams", "standard seams", "regular seams"],
      flatlock: ["flatlock", "flatlocked", "flatlock seams", "flatlocked seams", "flat seams", "flat locked seams", "chafe free seams"],
    },
  },
};
