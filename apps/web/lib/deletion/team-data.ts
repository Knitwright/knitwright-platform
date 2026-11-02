/**
 * The records that hold people's names for the production outputs (plan W4, decision 0032), and
 * what removes them. Deleting a design or an account removes them through their keys in the
 * database; erasing one team list is a delete of its order. The test beside this file reads the
 * migrations and fails if a table here stops being removed with its design.
 */
interface PersonalDataTable {
  readonly table: string;
  readonly holds: string;
  /** True when a person can erase it on its own, without deleting the design. */
  readonly erasableAlone: boolean;
}

export const PERSONAL_DATA_TABLES: readonly PersonalDataTable[] = [
  { table: "team_orders", holds: "the team list's name", erasableAlone: true },
  { table: "team_order_rows", holds: "player names, numbers and sizes", erasableAlone: true },
  { table: "strike_offs", holds: "the name and role of the person who accepted or rejected a test print, and its photos", erasableAlone: false },
  { table: "sign_offs", holds: "the names of people who signed a release", erasableAlone: false },
  { table: "production_releases", holds: "no names: a fingerprint of the team list only", erasableAlone: false },
  // The club workspace (plan V4, decision 0042). Rows go with their season or their brand through
  // their keys, and the server can erase one player or one season without deleting anything else.
  { table: "roster_players", holds: "player names, numbers and sizes", erasableAlone: true },
  { table: "club_seasons", holds: "no names of people: the name and dates of a season, and the key its roster hangs on", erasableAlone: true },
  { table: "club_invitations", holds: "the email addresses of people invited to join a club", erasableAlone: true },
  { table: "club_kits", holds: "no names of people: sponsor names are businesses, and the crest and logos are file ids", erasableAlone: false },
  // Ops console part 2 (plan W2-D, decision 0050). These hold no player names: a bag points at a line of the team
  // list by position and the name is read from the list when a label is printed. Their free-text notes could still
  // name someone, so every one is tied to its brand and goes with it. Only platform admins read them.
  { table: "ops_qc_inspections", holds: "no names: results, measurements typed by ops, photo file ids and a free-text note", erasableAlone: false },
  { table: "ops_exceptions", holds: "no names of players: an owner (a staff or factory contact) and a free-text note", erasableAlone: false },
  { table: "ops_exception_events", holds: "the same owner and note, as history", erasableAlone: false },
  { table: "ops_pack_bags", holds: "no names: the position of a line in the team list, a size and a count", erasableAlone: false },
  { table: "ops_cartons", holds: "no names: a carton's weight and size as typed by ops", erasableAlone: false },
  { table: "ops_shipments", holds: "no names of players: courier, tracking number and a free-text note", erasableAlone: false },
  // Ops completion (plan v5 O1, decision 0100). The same rule: tied to the brand and goes with it. The status
  // email is the one here that holds an address of its own, so it is named as that rather than as "no names".
  { table: "ops_qc_colour_readings", holds: "no names: a colour, the Delta-E the instrument gave and what it was judged against", erasableAlone: false },
  { table: "ops_inspection_bookings", holds: "no names: a provider, its reference and a free-text note", erasableAlone: false },
  { table: "ops_commercial_invoices", holds: "no names of people: the goods, their HS code and origin, and what the invoice could not state", erasableAlone: false },
  { table: "ops_customer_emails", holds: "the email address a status message went to, and the words as sent", erasableAlone: false },
  // Design comments (plan W4-D, decision 0063). A comment goes with its design, and so with its brand. The words can name
  // people, so the earlier words and the mentions go with the comment too; an author who removes a comment that has replies
  // empties it, and its earlier words and mentions go at once.
  { table: "design_comments", holds: "comment text that may name people, and the author's id", erasableAlone: false },
  { table: "design_comment_edits", holds: "the earlier words of a changed comment", erasableAlone: false },
  { table: "design_comment_mentions", holds: "the ids of members a comment names", erasableAlone: false },
  // Invited people (plan v5 Y8, decision 0086). An invite holds the address it was sent to, so it is
  // personal data about someone who may never have signed in. It goes with its design through
  // (project_id, brand_id), and so with the brand.
  { table: "share_invites", holds: "the email address a design was shared with, and the member's words to them", erasableAlone: false },
  // None of the nine can be erased on its own: a pin, a vote and an approval are append-only by
  // trigger, and a sign-up entry has no erase function of its own, unlike `roster_players`. So a
  // committee member who asks for their words to be removed can be answered today only by deleting
  // the whole design. Recorded as a finding for the owner by both reviews (0110 and security-v5 M3).
  // The committee link and the roster sign-up link (plan v5 Z7, decision 0087). Neither the strangers
  // who answer nor the players named have an account, so everything they leave is personal data about
  // someone who cannot delete it themselves. Every record hangs off its link by (link_id, brand_id);
  // the link hangs off the design or the season, and so off the brand. The tests below check both hops.
  { table: "committee_links", holds: "no names: a token fingerprint and who made the link", erasableAlone: false },
  { table: "committee_link_versions", holds: "no names: which design version sits in which slot", erasableAlone: false },
  { table: "committee_pins", holds: "the name a visitor typed and their comment on the design", erasableAlone: false },
  { table: "committee_votes", holds: "the name a visitor typed and which option they chose", erasableAlone: false },
  { table: "committee_approvals", holds: "the name a visitor typed and, when they offered one, their email address", erasableAlone: false },
  { table: "committee_locks", holds: "no names of visitors: which version a manager locked, and when", erasableAlone: false },
  { table: "roster_signup_links", holds: "no names: a token fingerprint and who made the link", erasableAlone: false },
  { table: "roster_signup_requests", holds: "a player's name and, when the manager has them, their phone number and email address", erasableAlone: false },
  { table: "roster_signup_entries", holds: "the name a player wants on the shirt, their number and their size", erasableAlone: false },
];

/**
 * Tables that hold an email address or a phone number and are deliberately NOT in the register
 * above, with the reason. The test beside this file requires every other table in every migration
 * that has such a column to be registered, so a new one cannot hold an address unnoticed.
 */
export const ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER: readonly { table: string; why: string }[] = [
  {
    table: "access_requests",
    why: "A request to be let in, made before any brand exists. It belongs to no brand, so no brand's deletion can take it; it is erased through the platform-admin screen instead.",
  },
  {
    table: "takedown_notices",
    why: "A third party's report that a brand is using their mark. Erasing it with the brand would destroy the record of the complaint and of what was decided. Retention is an owner decision (security-v5, M3).",
  },
];
