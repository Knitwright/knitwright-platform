import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { linkFailure } from "./links";

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
