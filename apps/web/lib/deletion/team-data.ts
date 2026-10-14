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
];
