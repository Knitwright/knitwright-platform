import { describe, expect, it } from "vitest";
import { openVotes, type HomeAnswer, type HomeLink } from "./facts";

const NOW = new Date("2026-10-14T12:00:00.000Z");

const link = (over: Partial<HomeLink> = {}): HomeLink => ({
  id: "l1",
  projectId: "p1",
  createdAt: "2026-10-10T00:00:00.000Z",
  expiresAt: "2026-11-10T00:00:00.000Z",
  revokedAt: null,
  ...over,
});

const answer = (over: Partial<HomeAnswer> = {}): HomeAnswer => ({
  linkId: "l1",
  vote: "yes",
  updatedAt: "2026-10-12T00:00:00.000Z",
  ...over,
});

const names = new Map([
  ["p1", "Home jersey"],
  ["p2", "Away jersey"],
]);

describe("openVotes", () => {
  it("adds up the votes of every open link of a design", () => {
    const links = [link(), link({ id: "l2", createdAt: "2026-10-11T00:00:00.000Z" })];
    const answers = [
      answer(),
      answer({ linkId: "l2", vote: "not_yet", updatedAt: "2026-10-13T00:00:00.000Z" }),
      answer({ linkId: "l2", vote: null }),
    ];
    expect(openVotes(links, answers, names, NOW)).toEqual([
      { projectId: "p1", projectName: "Home jersey", yes: 1, notYet: 1, answers: 3, latestAt: "2026-10-13T00:00:00.000Z" },
    ]);
  });

  it("counts a design whose open link has no answers yet, dated by the link", () => {
    expect(openVotes([link()], [], names, NOW)).toEqual([
      { projectId: "p1", projectName: "Home jersey", yes: 0, notYet: 0, answers: 0, latestAt: "2026-10-10T00:00:00.000Z" },
    ]);
  });

  it("leaves out revoked and expired links and their answers", () => {
    const links = [
      link({ id: "gone", revokedAt: "2026-10-12T00:00:00.000Z" }),
      link({ id: "old", projectId: "p2", expiresAt: "2026-10-13T00:00:00.000Z" }),
    ];
    const answers = [answer({ linkId: "gone" }), answer({ linkId: "old" })];
    expect(openVotes(links, answers, names, NOW)).toEqual([]);
  });

  it("leaves out a design whose name was not read", () => {
    expect(openVotes([link({ projectId: "unknown" })], [], names, NOW)).toEqual([]);
  });
});
