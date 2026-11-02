import { COMMENT_MAX } from "./fields";

/**
 * The words, limits and lists the share popover shows in the browser (spec F-S4 Share, plan v5 Y8,
 * decision 0081). Kept apart from the zod schemas in `lib/share/invites.ts`, as `lib/share/fields.ts`
 * is kept apart from `lib/share/schemas.ts`: a client component that reached a module holding a zod
 * schema would ship all of zod to the browser (`tests/architecture/client-weight.test.ts`).
 */

/** The three levels of the spec's popover. */
export const SHARE_ACCESS = ["view", "comment", "edit"] as const;
export type ShareAccess = (typeof SHARE_ACCESS)[number];

export const ACCESS_LABELS: Readonly<Record<ShareAccess, string>> = {
  view: "Can view",
  comment: "Can comment",
  edit: "Can edit",
};

export const ACCESS_NOTES: Readonly<Record<ShareAccess, string>> = {
  view: "Sees the drawings, colours and fabrics. Not the measurements, notes or files.",
  comment: "Sees the same, and can leave a vote and a comment.",
  edit: "Opens the design in the editor. Needs a Knitwright account.",
};

/** Who may open the design through its link. */
export const LINK_AUDIENCES = ["invited", "anyone"] as const;
export type LinkAudience = (typeof LINK_AUDIENCES)[number];

export const AUDIENCE_LABELS: Readonly<Record<LinkAudience, string>> = {
  invited: "Only invited people",
  anyone: "Anyone with the link can view",
};

export const AUDIENCE_NOTES: Readonly<Record<LinkAudience, string>> = {
  invited: "The link opens nothing on its own. Each invited person opens the design with their own invite.",
  anyone: "Whoever holds the link can see this version of the design.",
};

export const MESSAGE_MAX = COMMENT_MAX;
export const EMAIL_MAX = 320;

/** One invite as the database keeps it. */
export interface ShareInvite {
  readonly id: string;
  readonly email: string;
  readonly access: ShareAccess;
  readonly message: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly emailSentAt: string | null;
  readonly acceptedAt: string | null;
}

/** One row of the People-with-access list. */
export interface AccessRow {
  readonly id: string;
  readonly email: string;
  readonly accessLabel: string;
  readonly state: "open" | "revoked" | "expired";
  /** What has happened to the invite, in one sentence. */
  readonly stateSentence: string;
  /** Whether an email really went out, in one sentence. Never claims one that was not sent. */
  readonly emailSentence: string;
  readonly canRevoke: boolean;
}

const dayText = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const stateOf = (invite: ShareInvite, now: Date): AccessRow["state"] => {
  if (invite.revokedAt) return "revoked";
  return new Date(invite.expiresAt) <= now ? "expired" : "open";
};

const stateSentence = (invite: ShareInvite, state: AccessRow["state"]): string => {
  if (state === "revoked") return `Withdrawn on ${dayText(invite.revokedAt as string)}.`;
  if (state === "expired") return `Ran out on ${dayText(invite.expiresAt)}.`;
  const opened = invite.acceptedAt ? ` Opened it on ${dayText(invite.acceptedAt)}.` : " Has not opened it yet.";
  return `Works until ${dayText(invite.expiresAt)}.${opened}`;
};

const emailSentence = (invite: ShareInvite): string =>
  invite.emailSentAt ? `We emailed them on ${dayText(invite.emailSentAt)}.` : "We have not emailed them. Send them the invite link yourself.";

/** The People-with-access list: the invites of one design, the ones that still work first. */
export function buildAccessRows(invites: readonly ShareInvite[], now: Date): readonly AccessRow[] {
  const rows = invites.map((invite): AccessRow => {
    const state = stateOf(invite, now);
    return {
      id: invite.id,
      email: invite.email,
      accessLabel: ACCESS_LABELS[invite.access],
      state,
      stateSentence: stateSentence(invite, state),
      emailSentence: emailSentence(invite),
      canRevoke: state === "open",
    };
  });
  const order: Readonly<Record<AccessRow["state"], number>> = { open: 0, expired: 1, revoked: 2 };
  return [...rows].sort((a, b) => order[a.state] - order[b.state] || a.email.localeCompare(b.email));
}

/** The address an invited person opens. The same share page a link opens, with the invite's own token. */
export const inviteAddress = (siteUrl: string, token: string): string => `${siteUrl.replace(/\/+$/, "")}/s/${token}`;
