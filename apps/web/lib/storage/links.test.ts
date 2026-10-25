import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { LINK_LIFETIME_SECONDS, createDownloadLink, linkFailure } from "./links";

// The shape storage gives for a missing object, as seen against the local stack.
const missing = { name: "StorageApiError", message: "Object not found", status: 400, statusCode: "404" };

describe("linkFailure", () => {
  it("turns a not found answer into the general missing file answer", () => {
    const failure = linkFailure(missing);

    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe("not_found");
    expect(failure.message).toBe("That file does not exist.");
  });

  it("recognises not found when the status is a number", () => {
    expect((linkFailure({ message: "x", status: 404 }) as AppError).code).toBe("not_found");
  });

  it("keeps any other failure as a plain error with the cause, so it is logged", () => {
    const cause = { name: "StorageApiError", message: "Database timeout", status: 500, statusCode: "500" };

    const failure = linkFailure(cause);

    expect(failure).not.toBeInstanceOf(AppError);
    expect(failure.message).toBe("The link could not be made.");
    expect(failure.cause).toBe(cause);
  });

  it("treats a failure with no status as something other than a missing file", () => {
    const failure = linkFailure(new Error("fetch failed"));

    expect(failure).not.toBeInstanceOf(AppError);
    expect(failure.message).toBe("The link could not be made.");
  });

  it("treats no error at all (no link came back) as a failure to make the link", () => {
    expect(linkFailure(null).message).toBe("The link could not be made.");
  });
});

describe("createDownloadLink", () => {
  const ID = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";

  /** A client whose `files` lookup and signed-link call answer as given. */
  const clientWith = (row: { data: unknown; error: unknown }, signed: { data: unknown; error: unknown }) => {
    const lookup = { select: () => lookup, eq: () => lookup, maybeSingle: () => Promise.resolve(row) };
    return {
      from: () => lookup,
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve(signed) }) },
    } as unknown as SupabaseClient;
  };

  it("answers an id that is not an id as a missing file, without asking the database", async () => {
    const client = { from: () => { throw new Error("must not be called"); } } as unknown as SupabaseClient;
    await expect(createDownloadLink(client, "b", "nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("answers a file of another brand, or none, as a missing file", async () => {
    await expect(createDownloadLink(clientWith({ data: null, error: null }, { data: null, error: null }), "b", ID)).rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps a failed read of the record as a plain fault", async () => {
    await expect(createDownloadLink(clientWith({ data: null, error: { message: "x" } }, { data: null, error: null }), "b", ID)).rejects.toMatchObject({ message: "The file's record could not be read." });
  });

  it("gives a link that lasts a minute", async () => {
    const client = clientWith({ data: { bucket: "files", path: "b/f" }, error: null }, { data: { signedUrl: "https://example.test/f?token=1" }, error: null });
    expect(await createDownloadLink(client, "b", ID)).toEqual({ url: "https://example.test/f?token=1", expiresInSeconds: LINK_LIFETIME_SECONDS });
  });

  it("fails when storage gives no link, and says missing only for a not found answer", async () => {
    const row = { data: { bucket: "files", path: "b/f" }, error: null };
    await expect(createDownloadLink(clientWith(row, { data: null, error: { status: 404 } }), "b", ID)).rejects.toMatchObject({ code: "not_found" });
    await expect(createDownloadLink(clientWith(row, { data: { signedUrl: "" }, error: null }), "b", ID)).rejects.toMatchObject({ message: "The link could not be made." });
  });
});
