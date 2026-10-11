/**
 * The exact words a person agrees to, each with a version. A record of consent keeps the
 * version and the words, so it can always be shown what the person saw. The same rows are
 * written in the database (private.consent_wordings, migration 20261011020000), which takes
 * the words from there and never from the caller; a test checks the two match.
 *
 * Changing the words means a new version here and in a new migration. Never edit a version
 * that has been shown to anyone.
 */

export type Wording = Readonly<{ version: string; purpose: "marketing_email" | "logo_rights"; text: string }>;

/** The box at sign-up and in Settings. It is never ticked for the person. */
export const MARKETING_OPT_IN: Wording = {
  version: "marketing-email-v1",
  purpose: "marketing_email",
  text: "Email me about new templates, season deadlines and offers. You can stop at any time.",
};

/** What the unsubscribe page asks the person to confirm. A withdrawal only. */
export const MARKETING_UNSUBSCRIBE: Wording = {
  version: "marketing-email-unsubscribe-v1",
  purpose: "marketing_email",
  text: "Stop emails from Knitwright about new templates, season deadlines and offers.",
};

/** The box beside every upload of artwork that goes on a garment. */
export const LOGO_RIGHTS: Wording = {
  version: "logo-rights-v1",
  purpose: "logo_rights",
  text: "I own this logo or have permission to use it on garments.",
};

export const WORDINGS: readonly Wording[] = [MARKETING_OPT_IN, MARKETING_UNSUBSCRIBE, LOGO_RIGHTS];
