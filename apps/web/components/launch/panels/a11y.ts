/**
 * The accessible names of the rail panels this directory builds (plan v5, decision 0108), kept
 * apart from the components so they are tested on their own -- the pattern
 * `components/mockups/a11y.ts` and `components/inspiration/a11y.ts` set.
 *
 * The generic helpers of that file (`panelProps`, `listProps`, `filterProps`, `busyProps`,
 * `alertProps`, `collectionProps`) are imported rather than written again. The two here are the
 * ones whose words say "template" where the mockup library's say "scene", so neither file has to
 * carry both.
 *
 * One rule decides both: a control's accessible name begins with the words a person can see, so a
 * screen reader and voice control agree with the screen (axe's `label-content-name-mismatch`).
 */

/** What a screen reader hears after a filter chip's own words: how many, and of what. */
export const templateFilterSuffix = (group: string, count: number): string =>
  `, ${count} ${count === 1 ? "template" : "templates"}, ${group} filter`;

/** The Show all / Show fewer button of one collection. */
export const showAllTemplatesProps = (collection: string, open: boolean, hidden: number) => ({
  type: "button" as const,
  "aria-label": open ? `Show fewer ${collection} templates` : `Show all ${hidden} more ${collection} templates`,
  "aria-expanded": open,
});

/** What a screen reader hears after the visible words of a Start a design from this button. */
export const templateSuffix = (title: string): string => `: ${title}`;
