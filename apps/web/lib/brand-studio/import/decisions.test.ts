import { describe, expect, it } from "vitest";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { acceptedPictures, countOf, decide, decideKind, itemsOfKind, tickRights, uploadsFor, whyNoUploads } from "./decisions";
import { itemId } from "./items";
import { proposal } from "./fixtures/proposal";

/**
 * The rights tick is the one gate a third-party byte ever passes, so most of this file is about it:
 * an unticked proposal yields **no** upload at all, however many pictures were accepted.
 */

const now = new Date("2026-11-02T10:00:00.000Z");
const logoId = itemId("logo", "https://ravensmoor.test/media/logo.png");
const graphicId = itemId("graphic", "https://ravensmoor.test/media/shirt-1.png");

describe("decide", () => {
  it("changes one row and leaves every other row alone", () => {
    const after = decide(proposal(), logoId, "accepted");
    expect(after.items.find((item) => item.id === logoId)?.decision).toBe("accepted");
    expect(countOf(after, "accepted")).toBe(1);
    expect(countOf(after, "pending")).toBe(after.items.length - 1);
  });

  it("lets a person change their mind", () => {
    const after = decide(decide(proposal(), logoId, "accepted"), logoId, "rejected");
    expect(after.items.find((item) => item.id === logoId)?.decision).toBe("rejected");
  });

  it("leaves the tick alone, whatever is decided", () => {
    expect(decide(proposal(), logoId, "accepted").rights.ticked).toBe(false);
  });

  it("does nothing at all for a row that is not there", () => {
    const before = proposal();
    expect(decide(before, "colour:#123456", "accepted").items).toEqual(before.items);
  });
});

describe("decideKind", () => {
  it("takes every row of one kind and no row of another", () => {
    const after = decideKind(proposal(), "colour", "accepted");
    expect(itemsOfKind(after, "colour").every((item) => item.decision === "accepted")).toBe(true);
    expect(itemsOfKind(after, "logo").every((item) => item.decision === "pending")).toBe(true);
  });
});

describe("tickRights", () => {
  it("starts unticked and is only ever set by this function", () => {
    expect(proposal().rights.ticked).toBe(false);
    expect(tickRights(proposal(), true).rights.ticked).toBe(true);
    expect(tickRights(tickRights(proposal(), true), false).rights.ticked).toBe(false);
  });

  it("carries the same words as every other artwork upload, with their version", () => {
    expect(proposal().rights.text).toBe(LOGO_RIGHTS.text);
    expect(proposal().rights.wordingVersion).toBe(LOGO_RIGHTS.version);
  });
});

describe("acceptedPictures", () => {
  it("gives the facts of the pictures the person kept, and nothing else", () => {
    const after = decide(proposal(), logoId, "accepted");
    expect(acceptedPictures(after, "logo").map((picture) => picture.url)).toEqual(["https://ravensmoor.test/media/logo.png"]);
    expect(acceptedPictures(after, "graphic")).toEqual([]);
  });

  it("gives nothing for a picture that was rejected", () => {
    expect(acceptedPictures(decide(proposal(), logoId, "rejected"), "logo")).toEqual([]);
  });
});

describe("uploadsFor", () => {
  it("gives nothing at all while the rights box is unticked, however many were kept", () => {
    const kept = decide(decide(proposal(), logoId, "accepted"), graphicId, "accepted");
    expect(kept.rights.ticked).toBe(false);
    expect(uploadsFor(kept, "u1", now)).toEqual([]);
  });

  it("gives one intent per kept picture once the box is ticked, logos first", () => {
    const kept = tickRights(decide(decide(proposal(), logoId, "accepted"), graphicId, "accepted"), true);
    const uploads = uploadsFor(kept, "u1", now);
    expect(uploads.map((one) => one.assetKind)).toEqual(["logo", "graphic"]);
    expect(uploads[0]).toEqual({
      url: "https://ravensmoor.test/media/logo.png",
      assetKind: "logo",
      label: "Ravensmoor Athletic crest",
      contentType: "image/png",
      rights: { confirmedBy: "u1", confirmedAt: "2026-11-02T10:00:00.000Z", wordingVersion: LOGO_RIGHTS.version },
    });
  });

  it("records who ticked, when, and the version of the words they saw, on every intent", () => {
    const kept = tickRights(decide(proposal(), graphicId, "accepted"), true);
    expect(uploadsFor(kept, "u2", now).every((one) => one.rights.confirmedBy === "u2" && one.rights.wordingVersion !== "")).toBe(true);
  });

  it("gives nothing when the box is ticked but nothing was kept", () => {
    expect(uploadsFor(tickRights(proposal(), true), "u1", now)).toEqual([]);
  });

  it("carries no bytes: an intent is an address, a kind, a name, a type and the tick", () => {
    const kept = tickRights(decide(proposal(), logoId, "accepted"), true);
    expect(Object.keys(uploadsFor(kept, "u1", now)[0] ?? {}).sort()).toEqual(["assetKind", "contentType", "label", "rights", "url"]);
  });
});

describe("whyNoUploads", () => {
  it("says nothing is being kept when nothing is", () => {
    expect(whyNoUploads(proposal())).toContain("No picture is being kept");
  });

  it("asks for the tick when a picture is being kept and the box is unticked", () => {
    expect(whyNoUploads(decide(proposal(), logoId, "accepted"))).toBe(proposal().rights.ask);
  });

  it("says nothing stands in the way once the box is ticked", () => {
    expect(whyNoUploads(tickRights(decide(proposal(), logoId, "accepted"), true))).toBeNull();
  });
});
