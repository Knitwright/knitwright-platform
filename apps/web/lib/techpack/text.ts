/** The words that go with everything the platform proposes and nobody has confirmed. */
export const PROPOSAL_WORDS = "Proposed by Knitwright. Not confirmed by anyone.";

/** The note of a section that has fields still empty. */
export const SOME_MISSING = "Some details are still to be confirmed.";

/** "a", "a and b", "a, b and c". */
export const listOf = (words: readonly string[]): string =>
  words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.slice(-1).join("")}`;

export const sentenceCase = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
