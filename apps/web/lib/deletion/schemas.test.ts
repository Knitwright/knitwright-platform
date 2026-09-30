import { describe, expect, it } from "vitest";
import { CONFIRM_MESSAGE, CONFIRM_WORD, deleteAccountSchema, deleteDesignSchema } from "./schemas";

const PROJECT = "7e6d5c4b-3a2f-4e1d-9c0b-8a7f6e5d4c3b";

describe("deletion forms", () => {
  it("accept the confirmation word however it is typed", () => {
    for (const typed of [CONFIRM_WORD, " Delete ", "DELETE"]) {
      expect(deleteAccountSchema.safeParse({ confirm: typed }).success).toBe(true);
    }
  });

  it("refuse anything else, with a message that says what to type", () => {
    for (const typed of ["", "yes", "delet", "delete it"]) {
      const result = deleteAccountSchema.safeParse({ confirm: typed });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(CONFIRM_MESSAGE);
    }
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });

  it("need a design id for a design", () => {
    expect(deleteDesignSchema.safeParse({ projectId: PROJECT, confirm: "delete" }).data).toEqual({
      projectId: PROJECT,
      confirm: "delete",
    });
    expect(deleteDesignSchema.safeParse({ projectId: "nope", confirm: "delete" }).success).toBe(false);
  });
});
