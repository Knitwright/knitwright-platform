/**
 * Plain words for the technical terms of garment making (plan step 15, task 3). The guided flow
 * shows the plain word first and the factory's word beside it, so a person new to this learns
 * the words a factory will use without needing them to get started.
 *
 * Keys are lower case. No plain word uses another term of this list.
 */
export const PLAIN_WORDS: Readonly<Record<string, string>> = {
  "tech pack": "factory file",
  flat: "drawing",
  flats: "drawings",
  "point of measure": "measurement",
  "points of measure": "measurements",
  tolerance: "allowed difference",
  grading: "size steps",
  "base size": "sample size",
  "size run": "sizes you make",
  colourway: "colour version",
  colourways: "colour versions",
  construction: "how it is sewn",
  "seam allowance": "extra fabric at the seams",
  trim: "extras such as zips and cords",
  trims: "extras such as zips and cords",
  gsm: "fabric weight",
  provenance: "where a value came from",
  artwork: "logos and text",
  "bill of materials": "parts list",
  "care label": "washing label",
  svg: "drawing file",
  // Brand Studio (decision 0079). A brand reads these words on the Colours and Sportswear tabs.
  gamut: "the colours a print can reach",
  sublimation: "printing with heat",
};

const capitalised = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** The plain word for a term, or the text unchanged. A capital at the start is kept. */
export function plain(term: string): string {
  const words = PLAIN_WORDS[term.trim().toLowerCase()];
  if (words === undefined) return term;
  const first = term.trim().charAt(0);
  return first !== "" && first === first.toUpperCase() && first !== first.toLowerCase() ? capitalised(words) : words;
}

/** The plain word with the factory's term after it, such as "factory file (tech pack)". */
export function withPlain(term: string): string {
  const words = plain(term);
  return words === term ? term : `${words} (${term})`;
}
