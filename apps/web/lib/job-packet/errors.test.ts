import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { PACKET_NOT_FOUND, packetFailure, throwIfPacketFailed } from "./errors";

describe("packetFailure", () => {
  it.each([
    ["packet_exists", "This batch already has a factory link. Send it again or revoke it."],
    ["packet_revoked", "That factory link was revoked. Make a new one."],
    ["packet_full", "This link has taken as much as it can. Ask Knitwright for a new one."],
    ["illegal_step", "The steps go one at a time: Received, In production, Ready for QC."],
    ["append_only", "What a factory recorded can never be changed or removed."],
  ])("turns the hint %s into a sentence the reader can act on", (hint, message) => {
    expect(packetFailure({ code: "P0001", hint, message: "whatever the database said" })).toMatchObject({ code: "conflict", message });
  });

  it("names the note box when the note itself is refused", () => {
    const failure = packetFailure({ code: "22023", hint: "invalid_note", message: "A note has 1 to 1000 characters." });

    expect(failure.code).toBe("invalid_input");
    expect(failure.fields).toEqual({ note: ["A note has 1 to 1000 characters."] });
  });

  it("gives one answer for a token that is unknown, expired, revoked or the wrong shape", () => {
    for (const code of ["P0002", "22P02"]) {
      expect(packetFailure({ code, message: "whatever the database said" })).toMatchObject({ code: "not_found", message: PACKET_NOT_FOUND });
    }
  });

  it("reads a refused value as input to look at again", () => {
    for (const code of ["22023", "23514"]) expect(packetFailure({ code, message: "x" }).code).toBe("invalid_input");
  });

  it("hides anything else, keeping the fault only as the cause", () => {
    const failure = packetFailure({ code: "XX000", message: "secret detail" });

    expect(failure).toBeInstanceOf(AppError);
    expect(failure.code).toBe("internal");
    expect(failure.message).not.toContain("secret detail");
    expect(packetFailure({ message: "no code at all" }).code).toBe("internal");
  });

  it("does not read a hint it does not know as a conflict", () => {
    expect(packetFailure({ code: "XX000", hint: "something_else", message: "x" }).code).toBe("internal");
    expect(packetFailure({ code: "P0002", hint: null, message: "x" }).code).toBe("not_found");
  });
});

describe("throwIfPacketFailed", () => {
  it("passes when nothing failed and raises the failure when something did", () => {
    expect(throwIfPacketFailed(null)).toBeUndefined();
    expect(() => throwIfPacketFailed({ code: "P0002", message: "x" })).toThrow(PACKET_NOT_FOUND);
  });
});
