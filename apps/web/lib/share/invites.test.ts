import { describe, expect, it } from "vitest";
import {
  ACCESS_LABELS,
  AUDIENCE_LABELS,
  buildAccessRows,
  createShareInviteSchema,
  inviteAddress,
  linkAudienceSchema,
  revokeShareInviteSchema,
  SHARE_ACCESS,
  type ShareInvite,
} from "./invites";

/**
 * Invites to one design (spec F-S4 Share). The three access levels and the two link audiences are
 * the spec's own words. Nothing here claims an email was sent: that sentence is written from what
 * the database recorded after a provider took the message.
 */

const PROJECT = "7b1e0c4a-2d3f-4a5b-8c7d-6e5f4a3b2c1d";
const INVITE = "0e1d2c3b-4a59-4687-8796-a5b4c3d2e1f0";
const NOW = new Date("2026-11-10T12:00:00Z");

const invite = (patch: Partial<ShareInvite> = {}): ShareInvite => ({
  id: INVITE,
  email: "chair@northside.org",
  access: "comment",
  message: "",
  createdAt: "2026-11-01T09:00:00Z",
  expiresAt: "2026-12-01T09:00:00Z",
  revokedAt: null,
  emailSentAt: null,
  acceptedAt: null,
  ...patch,
});

describe("the words of the share popover", () => {
  it("offers the spec's three access levels and its two link audiences", () => {
    expect(SHARE_ACCESS).toEqual(["view", "comment", "edit"]);
    expect(Object.values(ACCESS_LABELS)).toEqual(["Can view", "Can comment", "Can edit"]);
    expect(AUDIENCE_LABELS.invited).toBe("Only invited people");
    expect(AUDIENCE_LABELS.anyone).toBe("Anyone with the link can view");
  });

  it("opens an invite on the share page, with no trailing slash doubled", () => {
    expect(inviteAddress("https://knitwright.test/", "a".repeat(43))).toBe(`https://knitwright.test/s/${"a".repeat(43)}`);
  });
});

describe("what an invite form may send", () => {
  const form = (over: Record<string, unknown> = {}) =>
    createShareInviteSchema.safeParse({ projectId: PROJECT, email: "Chair@Northside.ORG", access: "comment", ...over });

  it("takes an address, lower cased and trimmed, so one person is never on the list twice", () => {
    const read = form({ email: "  Chair@Northside.ORG  " });
    expect(read.success).toBe(true);
    expect(read.data?.email).toBe("chair@northside.org");
  });

  it("lasts 30 days unless another length is chosen", () => {
    expect(form().data?.days).toBe(30);
    expect(form({ days: "90" }).data?.days).toBe(90);
    expect(form({ days: "5" }).success).toBe(false);
  });

  it("takes no message as no message, and keeps one that is given", () => {
    expect(form().data?.message).toBe("");
    expect(form({ message: "  Have a look at the away kit.  " }).data?.message).toBe("Have a look at the away kit.");
  });

  it("refuses an address that is not one, an access level that is not offered, and a hidden character", () => {
    for (const bad of ["", "chair", "chair@", "chair@northside", "a@b.c d"]) expect(form({ email: bad }).success, bad).toBe(false);
    expect(form({ access: "owner" }).success).toBe(false);
    expect(form({ message: "Look\u0000here" }).success).toBe(false);
    expect(form({ projectId: "northside" }).success).toBe(false);
  });

  it("refuses a message longer than the limit", () => {
    expect(form({ message: "x".repeat(1001) }).success).toBe(false);
    expect(form({ message: "x".repeat(1000) }).success).toBe(true);
  });

  it("names the design in the other two forms, so its page can be refreshed", () => {
    expect(revokeShareInviteSchema.safeParse({ projectId: PROJECT, inviteId: INVITE }).success).toBe(true);
    expect(revokeShareInviteSchema.safeParse({ projectId: PROJECT, inviteId: "nope" }).success).toBe(false);
    expect(linkAudienceSchema.safeParse({ projectId: PROJECT, linkId: INVITE, audience: "invited" }).success).toBe(true);
    expect(linkAudienceSchema.safeParse({ projectId: PROJECT, linkId: INVITE, audience: "everyone" }).success).toBe(false);
  });
});

describe("the People-with-access list", () => {
  it("says nothing is shared when nobody is invited", () => {
    expect(buildAccessRows([], NOW)).toEqual([]);
  });

  it("says what a person may do, how long their invite works, and whether they have opened it", () => {
    const [row] = buildAccessRows([invite()], NOW);
    expect(row).toMatchObject({ email: "chair@northside.org", accessLabel: "Can comment", state: "open", canRevoke: true });
    expect(row?.stateSentence).toBe("Works until 1 December 2026. Has not opened it yet.");
    expect(buildAccessRows([invite({ acceptedAt: "2026-11-05T08:00:00Z" })], NOW)[0]?.stateSentence).toContain("Opened it on 5 November 2026.");
  });

  it("never claims an email that was not sent, and says plainly when one was", () => {
    expect(buildAccessRows([invite()], NOW)[0]?.emailSentence).toBe("We have not emailed them. Send them the invite link yourself.");
    expect(buildAccessRows([invite({ emailSentAt: "2026-11-01T09:00:01Z" })], NOW)[0]?.emailSentence).toBe("We emailed them on 1 November 2026.");
  });

  it("marks a withdrawn invite and one that has run out, and offers to withdraw neither", () => {
    const withdrawn = buildAccessRows([invite({ revokedAt: "2026-11-08T09:00:00Z" })], NOW)[0];
    expect(withdrawn).toMatchObject({ state: "revoked", canRevoke: false, stateSentence: "Withdrawn on 8 November 2026." });
    const over = buildAccessRows([invite({ expiresAt: "2026-11-09T09:00:00Z" })], NOW)[0];
    expect(over).toMatchObject({ state: "expired", canRevoke: false, stateSentence: "Ran out on 9 November 2026." });
  });

  it("puts the invites that still work first, then by address", () => {
    const rows = buildAccessRows(
      [
        invite({ id: "a", email: "zoe@club.org", revokedAt: "2026-11-08T09:00:00Z" }),
        invite({ id: "b", email: "mia@club.org" }),
        invite({ id: "c", email: "ana@club.org" }),
        invite({ id: "d", email: "bob@club.org", expiresAt: "2026-11-01T09:00:01Z" }),
      ],
      NOW,
    );
    expect(rows.map((row) => row.email)).toEqual(["ana@club.org", "mia@club.org", "bob@club.org", "zoe@club.org"]);
  });
});
