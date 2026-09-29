import { describe, expect, it } from "vitest";
import type { Brand } from "@/lib/server/core/guard";
import { chooseActiveBrand } from "./active";

const first: Brand = { id: "11111111-1111-4111-8111-111111111111", name: "First", role: "owner" };
const second: Brand = { id: "22222222-2222-4222-8222-222222222222", name: "Second", role: "owner" };

describe("chooseActiveBrand", () => {
  it("chooses the brand the user picked, when they belong to it", () => {
    expect(chooseActiveBrand([first, second], second.id)).toEqual(second);
  });

  it("falls back to the user's first brand when they picked none", () => {
    expect(chooseActiveBrand([first, second], undefined)).toEqual(first);
  });

  it("ignores a pick the user does not belong to, so a cookie cannot open another brand", () => {
    const foreign = "99999999-9999-4999-8999-999999999999";

    expect(chooseActiveBrand([first, second], foreign)).toEqual(first);
  });

  it("ignores a pick that is not an id at all", () => {
    expect(chooseActiveBrand([first], "'; drop table brands; --")).toEqual(first);
    expect(chooseActiveBrand([first], "")).toEqual(first);
  });

  it("has no brand for a user who belongs to none, whatever they picked", () => {
    expect(chooseActiveBrand([], undefined)).toBeNull();
    expect(chooseActiveBrand([], first.id)).toBeNull();
  });
});
