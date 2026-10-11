import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { LINK_NOT_FOUND, openShare, shareFailure } from "./service";

describe("shareFailure", () => {
  it("turns the limits the database keeps into a sentence the member can act on", () => {
    expect(shareFailure({ code: "P0001", hint: "too_many_links", message: "x" }, LINK_NOT_FOUND)).toMatchObject({
      code: "conflict",
      message: "This design has 20 links that still work. Revoke one first.",
    });
    expect(shareFailure({ code: "P0001", hint: "too_many_answers", message: "x" }, LINK_NOT_FOUND).code).toBe("conflict");
    expect(shareFailure({ code: "P0001", hint: "link_closed", message: "x" }, LINK_NOT_FOUND).message).toBe(
      "That link no longer works. Make a new one.",
    );
  });

  it("gives one answer for a missing link and another brand's link", () => {
    for (const code of ["P0002", "22P02"]) {
      expect(shareFailure({ code, message: "whatever the database said" }, LINK_NOT_FOUND)).toMatchObject({
        code: "not_found",
        message: LINK_NOT_FOUND,
      });
    }
  });

  it("reads a refused value as input to look at again, and hides anything else", () => {
    expect(shareFailure({ code: "22023", message: "A name has 1 to 60 characters." }, LINK_NOT_FOUND).code).toBe("invalid_input");
    const unknown = shareFailure({ code: "XX000", message: "secret detail" }, LINK_NOT_FOUND);
    expect(unknown).toBeInstanceOf(AppError);
    expect(unknown.code).toBe("internal");
    expect(unknown.message).not.toContain("secret detail");
  });
});

describe("openShare", () => {
  it("does not ask the database about a token that could never open a link", async () => {
    const rpc = vi.fn();

    expect(await openShare({ rpc } as unknown as SupabaseClient, "short")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
