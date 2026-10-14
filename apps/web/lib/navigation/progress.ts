/**
 * Whether a click on a link starts the move to another page of the app, so the progress line
 * at the top of the window should show until that page arrives. The browser handles new tabs,
 * downloads and clicks with a modifier key itself, and a link to the same page with another
 * query or hash shows no new page.
 */

export type LinkClick = Readonly<{
  /** The link's address, made absolute (an anchor's `href` property). */
  href: string;
  /** The address of the page the click is on. */
  current: string;
  /** Which mouse button: 0 is the main one. */
  button: number;
  /** Whether Ctrl, Cmd, Shift or Alt was held. */
  modified: boolean;
  target: string;
  download: boolean;
}>;

const readUrl = (address: string): URL | null => {
  try {
    return new URL(address);
  } catch {
    return null;
  }
};

export const opensAnotherPage = (click: LinkClick): boolean => {
  if (click.button !== 0 || click.modified || click.download) return false;
  if (click.target !== "" && click.target !== "_self") return false;
  const to = readUrl(click.href);
  const from = readUrl(click.current);
  if (!to || !from) return false;
  return to.origin === from.origin && to.pathname !== from.pathname;
};
