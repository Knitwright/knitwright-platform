/**
 * Who may do what in a club. A club is a brand (decision 0042), so these are the roles on a
 * membership. The database enforces every one of them; this table is for deciding what to show.
 */
export const CLUB_ROLES = ["owner", "admin", "kit_manager", "viewer"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

/** The roles a person can be given. The owner is the one who made the club and cannot be given away here. */
export const ASSIGNABLE_ROLES = ["admin", "kit_manager", "viewer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Readonly<Record<ClubRole, string>> = {
  owner: "Owner",
  admin: "Admin",
  kit_manager: "Kit manager",
  viewer: "Viewer",
};

export const ROLE_EXPLANATIONS: Readonly<Record<ClubRole, string>> = {
  owner: "Everything, including members. Cannot be removed.",
  admin: "Everything, including members.",
  kit_manager: "The kit, seasons and rosters. Cannot change members.",
  viewer: "Can look, cannot change anything.",
};

export type Ability = "manageKit" | "manageMembers";

const ABILITIES: Readonly<Record<Ability, readonly ClubRole[]>> = {
  manageKit: ["owner", "admin", "kit_manager"],
  manageMembers: ["owner", "admin"],
};

export const can = (role: ClubRole, ability: Ability): boolean => ABILITIES[ability].includes(role);

export const isClubRole = (value: unknown): value is ClubRole => CLUB_ROLES.some((role) => role === value);
