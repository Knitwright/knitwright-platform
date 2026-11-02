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
  // Committee link v2 and roster sign-up (plan v5 Z7, decision 0087). These are the only tables in the
  // product a person with no account writes to, so they are the ones most likely to hold a name nobody
  // on the brand typed. The rows already go with their design or their season through their keys, and
  // the migration's own comments say so; what was missing until review v5 (decision 0110) was their
  // place on this list, and so their place in the test below. Decision 0087 asked for both.
  //
  // None of them can be erased on its own: a pin, a vote and an approval are append-only by trigger,
  // and a sign-up entry has no erase function of its own, unlike `roster_players`. Review v5 lists that
  // as a finding for the owner, because a committee member who asks for their words to be removed can
  // be answered today only by deleting the whole design.
  { table: "committee_links", holds: "no names of people: a token hash, who made the link and when", erasableAlone: false },
  { table: "committee_link_versions", holds: "no names: which saved version each A/B/C slot shows", erasableAlone: false },
  { table: "committee_pins", holds: "the name a committee member gave and the words of their pin, which can name people", erasableAlone: false },
  { table: "committee_votes", holds: "the name a committee member gave with their vote", erasableAlone: false },
  { table: "committee_approvals", holds: "the name of whoever approved a version, and their email address when one was offered", erasableAlone: false },
  { table: "committee_locks", holds: "no names: which version a kit manager locked, against which approval and when", erasableAlone: false },
  { table: "roster_signup_links", holds: "no names of people: a token hash, who made the link and when", erasableAlone: false },
  { table: "roster_signup_requests", holds: "the names, phone numbers and email addresses of the players a club is waiting on", erasableAlone: false },
  { table: "roster_signup_entries", holds: "a player's shirt name, number, size and wearer group, as the player sent them", erasableAlone: false },
];
