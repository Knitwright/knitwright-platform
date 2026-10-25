/**
 * Comment text is typed by people, so it is untrusted, like a player's name (lib/orders/text). It is
 * cleaned the same way (composed form, no hidden or control characters, one space between words) but
 * keeps line breaks and allows any letters, because a comment is words, not something printed on a
 * shirt. The page shows it as plain text only.
 */

export const COMMENT_MAX_LENGTH = 2000;
export const EMPTY_COMMENT = "Write something before you send it.";
export const COMMENT_TOO_LONG = `A comment can be up to ${COMMENT_MAX_LENGTH} characters.`;

/** Control, format (such as right-to-left override), unassigned and private-use characters, except a line break. */
const HIDDEN = /[^\P{C}\n]/gu;
const SPACES = /[^\S\n]+/g;

export type CleanComment = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string };

export function cleanComment(raw: string): CleanComment {
  const text = raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(SPACES, " ")
    .replace(HIDDEN, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length === 0) return { ok: false, message: EMPTY_COMMENT };
  if (text.length > COMMENT_MAX_LENGTH) return { ok: false, message: COMMENT_TOO_LONG };
  return { ok: true, text };
}
