/**
 * The look of a text input or a select (docs/spec/10-design-system.md §8 "Inputs"): 44 px high,
 * r-md, a 1 px border, 0 12 px padding, body-lg. Hover darkens the border; focus is an electric
 * border with a 3 px electric-soft ring; an error is a `bad` border; disabled is a `soft` fill.
 */
const FIELD_STATES =
  "border border-border bg-bg text-body-lg text-text transition-colors duration-fast ease-out placeholder:text-muted-2 hover:border-border-strong focus-visible:border-electric focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-electric-soft disabled:cursor-not-allowed disabled:bg-soft disabled:text-muted-2 aria-[invalid=true]:border-bad";

export const FIELD_CONTROL = `h-11 rounded-md px-3 ${FIELD_STATES}`;

/** The same look for a box of several lines of text. */
export const TEXT_AREA = `rounded-md px-3 py-2.5 leading-relaxed ${FIELD_STATES}`;

/** The search field: 46 px, r-lg, the icon on the right. */
export const SEARCH_CONTROL = `h-11.5 rounded-lg pr-11 pl-3.5 ${FIELD_STATES}`;
