import type { FamilyWords } from "./words";

/**
 * Words that name an outerwear garment type or choice outright. A proposal written without a
 * garment professional, to be checked with the golden set (owner action A7). "Hoodie" alone
 * names no type, since it could be a pullover or a zip hoodie; it becomes a question.
 */
export const OUTERWEAR_WORDS: FamilyWords = {
  types: {
    "pullover-hoodie": ["pullover hoodie", "pullover hoody", "pullover hooded sweatshirt", "overhead hoodie", "pull on hoodie"],
    "zip-hoodie": ["zip hoodie", "zip up hoodie", "zipped hoodie", "zipper hoodie", "full zip hoodie", "zip through hoodie", "zip hoody"],
    "track-jacket": ["track jacket", "track top", "tracksuit jacket", "tracksuit top", "training jacket", "warm up jacket"],
  },
  choices: {
    "sleeve-type": {
      "set-in": ["set in sleeves", "set in sleeve", "set in"],
      raglan: ["raglan sleeves", "raglan sleeve", "raglan"],
    },
    hood: {
      "single-layer": ["single layer hood", "single layer", "unlined hood", "unlined", "no hood lining", "remove the hood lining"],
      lined: ["lined hood", "double layer hood", "two layer hood", "fully lined hood", "hood lining", "line the hood"],
    },
    "hood-drawcord": {
      none: [
        "no drawcord",
        "no drawstring",
        "no hood drawcord",
        "no hood cord",
        "without a drawcord",
        "without a drawstring",
        "remove the drawcord",
        "remove the drawstring",
        "drop the drawcord",
      ],
      drawcord: ["drawcord", "draw cord", "drawstring", "draw string", "hood drawcord", "hood drawstring", "hood cord"],
    },
    "front-opening": {
      none: ["no zip", "no front zip", "without a zip", "remove the zip", "remove the front zip", "closed front", "no front opening"],
      "full-zip": ["full zip", "full length zip", "front zip", "zip front", "zip up", "zip through", "zipped front", "centre front zip", "center front zip"],
    },
    collar: {
      none: ["no collar", "collarless", "without a collar", "remove the collar", "drop the collar", "plain neckband"],
      "stand-collar": ["stand collar", "stand up collar", "funnel collar", "funnel neck", "high collar"],
    },
    pockets: {
      none: ["no pockets", "without pockets", "remove the pockets", "drop the pockets", "pocketless"],
      kangaroo: ["kangaroo pocket", "kangaroo pockets", "kangaroo", "pouch pocket", "front pouch", "muff pocket", "hand warmer pocket"],
      "side-seam": ["side pockets", "side seam pockets", "pockets in the side seams", "hand pockets"],
      "zip-side": ["zip pockets", "zipped pockets", "zipper pockets", "zippered pockets", "zipped side pockets", "zip side pockets", "pockets with zips"],
    },
    cuffs: {
      "rib-cuff": ["ribbed cuffs", "rib cuffs", "cuffs", "cuffed sleeves", "ribbed sleeve ends"],
      hem: ["no cuffs", "without cuffs", "remove the cuffs", "hemmed sleeves", "plain hemmed sleeves", "plain sleeve hems"],
    },
    "hem-finish": {
      "rib-band": ["rib band", "ribbed band", "ribbed hem", "rib hem", "hem band", "ribbed hem band", "banded hem"],
      hem: ["plain hem", "no hem band", "no rib band", "no ribbed hem", "remove the hem band", "remove the rib band", "open hem"],
    },
  },
};
