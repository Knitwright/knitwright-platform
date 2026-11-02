import { describe, expect, it } from "vitest";
import { buildShareLinkViews, linkState, tallyOf, tallySentence, type ShareAnswer, type ShareLink } from "./responses";

const NOW = new Date("2026-10-11T12:00:00Z");

const link = (patch: Partial<ShareLink> = {}): ShareLink => ({
  id: "link-1",
  version: 2,
  createdAt: "2026-10-01T09:00:00Z",
  expiresAt: "2026-10-31T09:00:00Z",
  revokedAt: null,
  audience: "anyone",
  ...patch,
});

const answer = (patch: Partial<ShareAnswer> = {}): ShareAnswer => ({
  linkId: "link-1",
  name: "Sam",
  vote: "yes",
  comment: null,
  updatedAt: "2026-10-05T10:00:00Z",
  ...patch,
});

describe("linkState", () => {
  it("is open until it expires, then expired", () => {
    expect(linkState(link(), NOW)).toBe("open");
    expect(linkState(link({ expiresAt: "2026-10-11T12:00:00Z" }), NOW)).toBe("expired");
    expect(linkState(link({ expiresAt: "2026-10-10T00:00:00Z" }), NOW)).toBe("expired");
  });

  it("is revoked once revoked, whatever its expiry", () => {
    expect(linkState(link({ revokedAt: "2026-10-02T00:00:00Z" }), NOW)).toBe("revoked");
    expect(linkState(link({ revokedAt: "2026-10-02T00:00:00Z", expiresAt: "2026-10-03T00:00:00Z" }), NOW)).toBe("revoked");
  });
});

describe("tallyOf and tallySentence", () => {
  it("counts the yes and not yet votes, leaving out answers with no vote", () => {
    const tally = tallyOf([answer(), answer({ vote: "yes" }), answer({ vote: "not_yet" }), answer({ vote: null, comment: "Hm" })]);

    expect(tally).toEqual({ yes: 2, notYet: 1 });
    expect(tallySentence(tally)).toBe("2 yes, 1 not yet.");
  });

  it("says so when nobody has voted", () => {
    expect(tallySentence(tallyOf([]))).toBe("No votes yet.");
  });
});

describe("buildShareLinkViews", () => {
  it("shows each link's state, version, tally and comments, newest comment first", () => {
    const [view] = buildShareLinkViews(
      [link()],
      [
        answer({ name: "Ann", comment: "Love the navy.", updatedAt: "2026-10-04T10:00:00Z" }),
        answer({ name: "Bo", vote: "not_yet", comment: "Collar too high.", updatedAt: "2026-10-06T10:00:00Z" }),
        answer({ name: "Cy", vote: "yes" }),
      ],
      2,
      NOW,
    );

    expect(view).toMatchObject({
      id: "link-1",
      version: 2,
      state: "open",
      stateSentence: "Works until 31 Oct 2026.",
      createdSentence: "Made on 1 Oct 2026. Shows version 2.",
      canMove: false,
      tally: { yes: 2, notYet: 1 },
      tallySentence: "2 yes, 1 not yet.",
      answerCount: 3,
    });
    expect(view.comments).toEqual([
      { name: "Bo", vote: "not_yet", voteLabel: "Not yet", comment: "Collar too high.", when: "6 Oct 2026, 10:00 UTC" },
      { name: "Ann", vote: "yes", voteLabel: "Yes", comment: "Love the navy.", when: "4 Oct 2026, 10:00 UTC" },
    ]);
  });

  it("offers to move an open link that shows an older version", () => {
    const [view] = buildShareLinkViews([link({ version: 1 })], [], 3, NOW);

    expect(view.canMove).toBe(true);
    expect(view.moveLabel).toBe("Show version 3 instead");
  });

  it("does not offer to move a link that is revoked or expired", () => {
    const views = buildShareLinkViews(
      [link({ id: "a", version: 1, revokedAt: "2026-10-02T00:00:00Z" }), link({ id: "b", version: 1, expiresAt: "2026-10-05T00:00:00Z" })],
      [],
      3,
      NOW,
    );

    expect(views.map((view) => [view.state, view.canMove])).toEqual([
      ["revoked", false],
      ["expired", false],
    ]);
    expect(views[0].stateSentence).toBe("Revoked on 2 Oct 2026. It no longer opens.");
    expect(views[1].stateSentence).toBe("Expired on 5 Oct 2026. It no longer opens.");
  });

  it("lists open links first, then the rest, newest first within each, and keeps answers with their link", () => {
    const views = buildShareLinkViews(
      [
        link({ id: "old-open", createdAt: "2026-09-01T00:00:00Z" }),
        link({ id: "revoked", createdAt: "2026-10-09T00:00:00Z", revokedAt: "2026-10-10T00:00:00Z" }),
        link({ id: "new-open", createdAt: "2026-10-08T00:00:00Z" }),
      ],
      [answer({ linkId: "revoked", comment: "Kept." }), answer({ linkId: "new-open", vote: "not_yet" })],
      2,
      NOW,
    );

    expect(views.map((view) => view.id)).toEqual(["new-open", "old-open", "revoked"]);
    expect(views.map((view) => view.answerCount)).toEqual([1, 0, 1]);
    expect(views[2].comments[0]?.comment).toBe("Kept.");
  });
});
