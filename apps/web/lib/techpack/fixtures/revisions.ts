import type { RevisionInput } from "../input";

/** A made-up history of saved versions, for tests only. */
export const revisions = (count: number): RevisionInput[] =>
  Array.from({ length: count }, (_, index) => ({
    version: index + 1,
    date: `${index + 1} Sep 2026`,
    note: `Change ${index + 1}.`,
    by: index % 2 === 0 ? "Sam Test" : null,
  }));
