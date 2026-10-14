import type { ShareVote } from "@/lib/share/schemas";
import type { OpenVote } from "./needs-you";

/** The rows the studio home reads, as plain data, and how they add up. */

export interface HomeLink {
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface HomeAnswer {
  readonly linkId: string;
  readonly vote: ShareVote | null;
  readonly updatedAt: string;
}

/** A link still opens when nobody revoked it and it has not run out. The same rule as the design page's. */
const isOpen = (link: HomeLink, now: Date): boolean => link.revokedAt === null && Date.parse(link.expiresAt) > now.getTime();

const later = (a: string, b: string): string => (Date.parse(b) > Date.parse(a) ? b : a);

/**
 * The answers left through each design's open share links, added together, one entry for each
 * design that has an open link. A design whose name is not in `names` is left out.
 */
export function openVotes(
  links: readonly HomeLink[],
  answers: readonly HomeAnswer[],
  names: ReadonlyMap<string, string>,
  now: Date,
): OpenVote[] {
  const open = links.filter((link) => names.has(link.projectId) && isOpen(link, now));
  const projectOf = new Map(open.map((link) => [link.id, link.projectId]));
  const byProject = new Map<string, OpenVote>();
  for (const link of open) {
    const seen = byProject.get(link.projectId);
    byProject.set(link.projectId, {
      projectId: link.projectId,
      projectName: names.get(link.projectId) ?? "",
      yes: seen?.yes ?? 0,
      notYet: seen?.notYet ?? 0,
      answers: seen?.answers ?? 0,
      latestAt: seen ? later(seen.latestAt, link.createdAt) : link.createdAt,
    });
  }
  for (const answer of answers) {
    const projectId = projectOf.get(answer.linkId);
    const seen = projectId === undefined ? undefined : byProject.get(projectId);
    if (projectId === undefined || seen === undefined) continue;
    byProject.set(projectId, {
      ...seen,
      yes: seen.yes + (answer.vote === "yes" ? 1 : 0),
      notYet: seen.notYet + (answer.vote === "not_yet" ? 1 : 0),
      answers: seen.answers + 1,
      latestAt: later(seen.latestAt, answer.updatedAt),
    });
  }
  return [...byProject.values()];
}
