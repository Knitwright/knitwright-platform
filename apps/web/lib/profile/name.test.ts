import { describe, expect, it } from "vitest";
import { displayNameFormSchema, profileNameOf } from "./name";

describe("the name a person gives in Settings", () => {
  it("is trimmed", () => {
    expect(displayNameFormSchema.parse({ name: "  Ada Lovelace " })).toEqual({ name: "Ada Lovelace" });
  });

  it("may be empty, which means the email address is shown", () => {
    expect(displayNameFormSchema.parse({ name: "   " })).toEqual({ name: "" });
  });

  it("is at most 80 characters, with no line breaks or hidden characters", () => {
    expect(displayNameFormSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
    expect(displayNameFormSchema.safeParse({ name: "Ada\nLovelace" }).success).toBe(false);
    expect(displayNameFormSchema.safeParse({ name: "Ada\u0000" }).success).toBe(false);
  });
});

describe("profileNameOf", () => {
  it("reads the name a person set, then the name from Google, then nothing", () => {
    expect(profileNameOf({ display_name: "Ada", full_name: "Ada L" })).toBe("Ada");
    expect(profileNameOf({ full_name: "Ada L" })).toBe("Ada L");
    expect(profileNameOf({ display_name: "  " })).toBe("");
    expect(profileNameOf(undefined)).toBe("");
    expect(profileNameOf({ display_name: 42 })).toBe("");
  });
});
