import { can, type ClubRole } from "@/lib/clubs/roles";

/**
 * The one-line summaries on Settings' cards (09 screen 19, d19). Pure, so they are tested apart.
 */

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "2 editors · 3 viewers": an editor is anyone who may change the kit; a viewer only looks. */
export function memberSummary(roles: readonly ClubRole[]): string {
  const editors = roles.filter((role) => can(role, "manageKit")).length;
  const viewers = roles.length - editors;
  if (roles.length === 0) return "No members yet";
  return viewers === 0 ? plural(editors, "editor", "editors") : `${plural(editors, "editor", "editors")} · ${plural(viewers, "viewer", "viewers")}`;
}

/** "Signed in as ana@example.com", or the name when there is one. */
export const accountSummary = (name: string, email: string | null): string =>
  name ? `${name}${email ? ` · ${email}` : ""}` : email ? `Signed in as ${email}` : "Signed in";
