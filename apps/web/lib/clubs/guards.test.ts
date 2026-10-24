import { describe, expect, it } from "vitest";
import type { MemberSession } from "@/lib/server/core/guard";
import { requireAbility, whoOf } from "./guards";

const as = (role: MemberSession["brand"]["role"]): MemberSession => ({ userId: "u", email: null, brand: { id: "b", name: "FC", role } });

describe("requireAbility", () => {
  it("lets a kit manager change the kit but not members", () => {
    expect(() => requireAbility(as("kit_manager"), "manageKit")).not.toThrow();
    expect(() => requireAbility(as("kit_manager"), "manageMembers")).toThrow(/does not allow/);
  });
  it("refuses a viewer everything", () => {
    expect(() => requireAbility(as("viewer"), "manageKit")).toThrow(/does not allow/);
    expect(() => requireAbility(as("viewer"), "manageMembers")).toThrow(/does not allow/);
  });
  it("lets an admin and the owner do both", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(() => requireAbility(as(role), "manageKit")).not.toThrow();
      expect(() => requireAbility(as(role), "manageMembers")).not.toThrow();
    }
  });
});

describe("whoOf", () => {
  it("takes the brand and person from the session", () => {
    expect(whoOf(as("owner"))).toEqual({ brandId: "b", userId: "u" });
  });
});
