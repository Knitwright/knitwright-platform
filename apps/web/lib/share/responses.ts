import { formatDate, formatDateTime } from "@/lib/projects/dates";
import type { ShareVote } from "./schemas";

/**
 * What a member sees of their share links on the design page: whether each still opens, which
 * version it shows, the votes and the comments. Plain data, worked out on the server.
 */

export interface ShareLink {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface ShareAnswer {
  readonly linkId: string;
  readonly name: string;
  readonly vote: ShareVote | null;
  readonly comment: string | null;
  readonly updatedAt: string;
}

export type LinkState = "open" | "expired" | "revoked";

export interface Tally {
  readonly yes: number;
  readonly notYet: number;
}

export interface ShareComment {
  readonly name: string;
  readonly vote: ShareVote | null;
  readonly voteLabel: string | null;
  readonly comment: string;
  readonly when: string;
}

export interface ShareLinkView {
  readonly id: string;
  readonly version: number;
  readonly state: LinkState;
  readonly stateSentence: string;
  readonly createdSentence: string;
  /** True when the link is open and the design has a newer version. */
  readonly canMove: boolean;
  readonly moveLabel: string;
  readonly tally: Tally;
  readonly tallySentence: string;
  readonly answerCount: number;
  /** Answers with a comment, newest first. */
  readonly comments: readonly ShareComment[];
}

export const VOTE_LABELS: Readonly<Record<ShareVote, string>> = { yes: "Yes", not_yet: "Not yet" };

export const linkState = (link: ShareLink, now: Date): LinkState => {
  if (link.revokedAt !== null) return "revoked";
  return Date.parse(link.expiresAt) > now.getTime() ? "open" : "expired";
};

export const tallyOf = (answers: readonly ShareAnswer[]): Tally => ({
  yes: answers.filter((entry) => entry.vote === "yes").length,
  notYet: answers.filter((entry) => entry.vote === "not_yet").length,
});

export const tallySentence = (tally: Tally): string =>
  tally.yes + tally.notYet === 0 ? "No votes yet." : `${tally.yes} yes, ${tally.notYet} not yet.`;

const stateSentence = (link: ShareLink, state: LinkState): string => {
  if (state === "revoked") return `Revoked on ${formatDate(link.revokedAt ?? "")}. It no longer opens.`;
  if (state === "expired") return `Expired on ${formatDate(link.expiresAt)}. It no longer opens.`;
  return `Works until ${formatDate(link.expiresAt)}.`;
};

const newestFirst = <T>(time: (item: T) => string) => (a: T, b: T): number => Date.parse(time(b)) - Date.parse(time(a));

const commentsOf = (answers: readonly ShareAnswer[]): ShareComment[] =>
  answers
    .flatMap((entry) =>
      entry.comment === null
        ? []
        : [{ entry, comment: entry.comment }],
    )
    .sort(newestFirst(({ entry }) => entry.updatedAt))
    .map(({ entry, comment }) => ({
      name: entry.name,
      vote: entry.vote,
      voteLabel: entry.vote ? VOTE_LABELS[entry.vote] : null,
      comment,
      when: formatDateTime(entry.updatedAt),
    }));

/** Every link of a design, open ones first and newest first within each, with its own answers. */
export function buildShareLinkViews(
  links: readonly ShareLink[],
  answers: readonly ShareAnswer[],
  currentVersion: number,
  now: Date,
): ShareLinkView[] {
  const byNewest = [...links].sort(newestFirst((link) => link.createdAt));
  const states = new Map(byNewest.map((link) => [link.id, linkState(link, now)]));
  const ordered = [...byNewest.filter((link) => states.get(link.id) === "open"), ...byNewest.filter((link) => states.get(link.id) !== "open")];
  return ordered.map((link) => {
    const state = states.get(link.id) ?? "expired";
    const own = answers.filter((entry) => entry.linkId === link.id);
    const tally = tallyOf(own);
    return {
      id: link.id,
      version: link.version,
      state,
      stateSentence: stateSentence(link, state),
      createdSentence: `Made on ${formatDate(link.createdAt)}. Shows version ${link.version}.`,
      canMove: state === "open" && link.version < currentVersion,
      moveLabel: `Show version ${currentVersion} instead`,
      tally,
      tallySentence: tallySentence(tally),
      answerCount: own.length,
      comments: commentsOf(own),
    };
  });
}
