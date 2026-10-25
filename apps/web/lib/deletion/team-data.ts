/**
 * The records that hold people's names for the production outputs (plan W4, decision 0032), and
 * what removes them. Deleting a design or an account removes them through their keys in the
 * database; erasing one team list is a delete of its order. The test beside this file reads the
 * migrations and fails if a table here stops being removed with its design.
 */
export interface PersonalDataTable {
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
  // Design comments (plan W4-D, decision 0063). A comment goes with its design, and so with its brand. The words can name
  // people, so the earlier words and the mentions go with the comment too; an author who removes a comment that has replies
  // empties it, and its earlier words and mentions go at once.
  { table: "design_comments", holds: "comment text that may name people, and the author's id", erasableAlone: false },
  { table: "design_comment_edits", holds: "the earlier words of a changed comment", erasableAlone: false },
  { table: "design_comment_mentions", holds: "the ids of members a comment names", erasableAlone: false },
];
