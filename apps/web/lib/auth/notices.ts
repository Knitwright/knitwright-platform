/**
 * Messages a page may show because of a `?notice=` value in its address. Only these
 * keys are accepted, so nothing a link carries is ever shown as text.
 */
export const NOTICES = {
  "google-failed": {
    tone: "warn",
    text: "Sign-in with Google did not finish. Try again, or use your email and password.",
  },
  "sign-up-closed": {
    tone: "warn",
    text: "Sign-up is closed. Knitwright is not open to new accounts yet.",
  },
  "link-missing": {
    tone: "warn",
    text: "That link is incomplete. Open the link from your email again, or ask for a new one.",
  },
  "account-deleted": {
    tone: "ok",
    text: "Your account and everything in it have been deleted.",
  },
} as const;

export type NoticeKey = keyof typeof NOTICES;

export const noticeFor = (value: unknown): (typeof NOTICES)[NoticeKey] | null =>
  typeof value === "string" && Object.hasOwn(NOTICES, value) ? NOTICES[value as NoticeKey] : null;

const SIGNUP_CLOSED = /^sign-up is closed/i;

type GoogleReturn = Readonly<{ error?: string; error_description?: string }>;

/**
 * Which notice to show when Google sign-in comes back without a usable code. The
 * sign-in service describes what went wrong in the address. That text is only matched
 * against what the database hook is known to write. It is never shown.
 */
export const noticeAfterGoogle = (query: GoogleReturn): NoticeKey =>
  SIGNUP_CLOSED.test(query.error_description ?? "") ? "sign-up-closed" : "google-failed";
