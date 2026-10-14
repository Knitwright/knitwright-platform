/**
 * The widths a page may take, so pages stop picking their own. On a phone every one of them
 * is the full screen less the side padding.
 *
 * - form: one short form on its own, such as sign-in or the welcome page. Never narrower.
 * - reading: long text, such as a legal document, held to a comfortable line length.
 * - content: every other page. The same width as the studio and its header.
 */
export const PAGE_WIDTH = {
  form: "max-w-xl",
  reading: "max-w-3xl",
  content: "max-w-6xl",
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

/** The outer frame of a page: centred, the chosen width, and the side padding every page uses. */
export const pageFrame = (width: PageWidth): string => `mx-auto w-full ${PAGE_WIDTH[width]} px-5`;
