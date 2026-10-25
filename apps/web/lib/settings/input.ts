import type { SettingDef } from "./types";

export type Parsed = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string };

const fail = (message: string): Parsed => ({ ok: false, message });
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toNumber = (text: string): number => (text.trim() === "" ? Number.NaN : Number(text));

/** Splits "left = right" lines. A line without " = " is an error naming the line. */
function splitLines(raw: string): { pairs: [string, string][] } | { error: string } {
  const pairs: [string, string][] = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter((l) => l !== "")) {
    const at = line.indexOf("=");
    if (at < 1) return { error: `Write each line as "name = value". This one is not: "${line}".` };
    pairs.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return { pairs };
}

function parseLines(def: SettingDef, raw: string): Parsed {
  const split = splitLines(raw);
  if ("error" in split) return fail(split.error);
  if (def.lines === "ladder") {
    return { ok: true, value: split.pairs.map(([pieces, price]) => ({ fromPieces: toNumber(pieces), unitPrice: toNumber(price) })) };
  }
  const entries = split.pairs.map(([name, value]) => [name, def.lines === "numbers" ? toNumber(value) : value] as const);
  return { ok: true, value: Object.fromEntries(entries) };
}

/** Turns what the person typed into a value, then checks it against the setting's schema, in words. */
export function parseInput(def: SettingDef, raw: string): Parsed {
  const text = raw.trim();
  let value: unknown;
  switch (def.input) {
    case "number":
    case "weekday":
      value = toNumber(text);
      break;
    case "optionalNumber":
      value = text === "" ? null : toNumber(text);
      break;
    case "time": {
      const match = TIME.exec(text);
      if (!match) return fail("Give the time as hours and minutes, such as 07:00.");
      value = Number(match[1]) * 60 + Number(match[2]);
      break;
    }
    case "list":
      value = text.split(",").map((part) => part.trim()).filter((part) => part !== "");
      break;
    case "lines": {
      const parsed = parseLines(def, raw);
      if (!parsed.ok) return parsed;
      value = parsed.value;
      break;
    }
  }
  const checked = def.schema.safeParse(value);
  return checked.success ? { ok: true, value: checked.data } : fail(checked.error.issues[0]?.message ?? "That value is not allowed.");
}

const clock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The text a form shows for a value; the inverse of parseInput. */
export function formatInput(def: SettingDef, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (def.input) {
    case "time":
      return clock(Number(value));
    case "list":
      return (value as readonly string[]).join(", ");
    case "lines":
      return Array.isArray(value)
        ? (value as { fromPieces: number; unitPrice: number }[]).map((s) => `${s.fromPieces} = ${s.unitPrice}`).join("\n")
        : Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k} = ${String(v)}`).join("\n");
    default:
      return String(value);
  }
}
