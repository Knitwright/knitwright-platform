import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, CLUB_ROLES, can, isClubRole } from "./roles";

describe("club roles", () => {
  it.each([
    ["owner", true, true],
    ["admin", true, true],
    ["kit_manager", true, false],
    ["viewer", false, false],
  ] as const)("%s: kit %s, members %s", (role, kit, members) => {
    expect(can(role, "manageKit")).toBe(kit);
    expect(can(role, "manageMembers")).toBe(members);
  });

  it("never offers the owner role to give", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(ASSIGNABLE_ROLES.every((role) => CLUB_ROLES.includes(role))).toBe(true);
  });

  it("recognises only real roles", () => {
    expect(isClubRole("viewer")).toBe(true);
    expect(isClubRole("root")).toBe(false);
    expect(isClubRole(undefined)).toBe(false);
  });
});
