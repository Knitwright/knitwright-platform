import type { FamilyWords } from "./words";

/**
 * Words that name a bottoms garment type or choice outright. A proposal written without a
 * garment professional, to be checked with the golden set (owner action A7). Words that only
 * hint at a choice ("sporty", "for running") are left out on purpose, so they become a question.
 */
export const BOTTOMS_WORDS: FamilyWords = {
  types: {
    shorts: ["shorts", "short pants", "running shorts", "gym shorts", "training shorts"],
    joggers: ["joggers", "jogger", "jogging bottoms", "jogging pants", "sweatpants", "sweat pants", "cuffed sweatpants"],
    leggings: ["leggings", "legging", "tights", "running tights", "yoga pants"],
    "track-pants": ["track pants", "trackpants", "track pant", "tracksuit bottoms", "tracksuit pants", "track bottoms", "trackies"],
  },
  choices: {
    "leg-length": {
      short: ["short leg", "short legs", "above the knee", "above knee length"],
      cropped: ["cropped", "cropped leg", "cropped legs", "cropped length", "three quarter length", "capri length", "capri"],
      full: ["full length", "full length legs", "full leg", "full legs", "ankle length", "long legs", "long leg", "down to the ankle"],
    },
    waistband: {
      "elastic-drawcord": [
        "drawcord",
        "draw cord",
        "drawstring",
        "draw string",
        "drawcord waist",
        "drawstring waist",
        "elastic with drawcord",
        "elastic with a drawcord",
        "elastic waistband with drawcord",
        "elastic waistband with a drawcord",
        "elastic waist with a drawstring",
      ],
      elastic: [
        "elastic waistband",
        "elastic waist",
        "elasticated waist",
        "elasticated waistband",
        "no drawcord",
        "no drawstring",
        "without a drawcord",
        "without a drawstring",
        "without drawcord",
        "remove the drawcord",
        "remove the drawstring",
        "drop the drawcord",
      ],
      "wide-band": ["wide band", "wide waistband", "wide flat band", "flat waistband", "wide flat waistband", "high waistband", "yoga waistband"],
    },
    "leg-finish": {
      hem: ["plain hem", "plain hems", "hemmed legs", "hemmed leg", "open hem", "open hems", "open leg", "open legs", "no cuffs", "without cuffs", "remove the cuffs"],
      "rib-cuff": ["ribbed cuffs", "rib cuffs", "cuffs", "cuffed ankles", "cuffed legs", "cuffed", "ribbed ankle cuffs", "ankle cuffs"],
      "ankle-zip": ["ankle zips", "ankle zip", "zip at the ankle", "zips at the ankle", "zips at the ankles", "zipped ankles", "zipped hems", "zip hems"],
    },
    gusset: {
      none: ["no gusset", "without a gusset", "without gusset", "remove the gusset", "drop the gusset"],
      "crotch-gusset": ["gusset", "crotch gusset", "gusseted crotch", "gusseted"],
    },
    "side-stripe": {
      none: [
        "no stripe",
        "no stripes",
        "no side stripe",
        "no side stripes",
        "without stripes",
        "without a stripe",
        "remove the stripe",
        "remove the stripes",
        "remove the side stripe",
        "remove the side stripes",
        "plain sides",
      ],
      "contrast-stripe": [
        "side stripe",
        "side stripes",
        "contrast stripe",
        "contrast stripes",
        "contrast side stripe",
        "stripe down the side",
        "stripes down the side",
        "stripe down the leg",
        "stripe down the legs",
        "stripes down the legs",
        "racing stripe",
        "racing stripes",
      ],
    },
    pockets: {
      none: ["no pockets", "without pockets", "remove the pockets", "drop the pockets", "pocketless"],
      "side-seam": ["side pockets", "side seam pockets", "pockets in the side seams", "hand pockets", "pockets"],
      "zip-side": [
        "zip pockets",
        "zipped pockets",
        "zipper pockets",
        "zippered pockets",
        "zipped side pockets",
        "zip side pockets",
        "pockets with zips",
        "pockets with a zip",
      ],
    },
  },
};
