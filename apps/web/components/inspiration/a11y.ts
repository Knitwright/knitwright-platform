/**
 * The accessible names and states of the inspiration panel (decision 0082, decision 0064's accessibility pass). Kept
 * apart from the components so the attributes are tested on their own.
 */

/** The panel itself: a labelled region, busy while a refresh is in flight. */
export const panelProps = (headingId: string, busy: boolean) => ({
  role: "region" as const,
  "aria-labelledby": headingId,
  "aria-busy": busy,
});

/** One tag chip's remove button. */
export const removeTagProps = (text: string) => ({ type: "button" as const, "aria-label": `Remove the tag ${text}` });

/** One tag chip's pin button, which says whether the tag is pinned. */
export const pinTagProps = (text: string, pinned: boolean) => ({
  type: "button" as const,
  "aria-label": pinned ? `Unpin the tag ${text}` : `Pin the tag ${text}`,
  "aria-pressed": pinned,
});

/** The "Suggest from this" button of one card. */
export const suggestProps = (label: string) => ({ type: "button" as const, "aria-label": label });

/** The link that opens a card's source, in a new tab, telling nobody where the person came from. */
export const openProps = (url: string, label: string) => ({
  href: url,
  target: "_blank" as const,
  rel: "noreferrer noopener" as const,
  "aria-label": label,
});

/** A list of sources or suggestions: one list, so a screen reader counts them. */
export const listProps = (label: string) => ({ role: "list" as const, "aria-label": label });
