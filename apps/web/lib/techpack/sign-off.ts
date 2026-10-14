import { TBC, textCell, type Cell } from "./cell";
import type { SignOffRecord, SignOffRole, StrikeOffRecord } from "./production/input";
import { SECTION_TITLES, type SignOffSection } from "./types";

export const NOBODY_HAS_CHECKED = "Nobody has checked this specification yet.";

const ROLES: readonly (readonly [SignOffRole, string])[] = [
  ["pattern", "Pattern"],
  ["print", "Print"],
  ["production", "Production"],
  ["club", "Club"],
];

const named = (text: string): Cell => textCell(text, "user-edited");

/**
 * The sign-off page. Each role is a line for a named person and a date, taken from a record.
 * With no record the line is to be confirmed, and the page says nobody has checked the specification.
 * Nothing in the document can fill a line: only a record of a real person does.
 */
export function buildSignOff(records: readonly SignOffRecord[] = [], strikeOff: StrikeOffRecord | null = null): SignOffSection {
  const lines = ROLES.map(([role, label]) => {
    const record = records.find((candidate) => candidate.role === role);
    return { role: label, name: record ? named(record.name) : TBC, date: record ? named(record.date) : TBC };
  });
  const signed = lines.filter((line) => line.name.status === "set");
  const statement =
    signed.length === 0 && strikeOff === null
      ? NOBODY_HAS_CHECKED
      : `Signed by ${signed.length} of ${lines.length} roles. ${strikeOff ? `The strike-off was accepted by ${strikeOff.name} on ${strikeOff.date}.` : "No strike-off has been accepted."}`;
  return {
    id: "sign-off",
    title: SECTION_TITLES["sign-off"],
    note: null,
    statement,
    lines,
    strikeOff: {
      acceptedBy: strikeOff ? named(strikeOff.name) : TBC,
      date: strikeOff ? named(strikeOff.date) : TBC,
      result: strikeOff?.result ? named(strikeOff.result) : TBC,
    },
  };
}
