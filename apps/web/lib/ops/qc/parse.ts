import type { Measurement } from "./checklist";

/** A line of a form field, as text. Nothing is guessed: a line that cannot be read is reported, not skipped. */
export type Parsed<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; problem: string }>;

const lines = (text: string): string[] => text.split(/\r?\n|;/).map((l) => l.trim()).filter((l) => l !== "");

const number = (text: string): number | null => (/^\d+(\.\d{1,3})?$/.test(text.trim()) ? Number(text) : null);

/** `Chest width, 520, 522, 5` per line: the point, the spec, the measured value and the tolerance, in millimetres. */
export function parseMeasurements(text: string): Parsed<readonly Measurement[]> {
  const found: Measurement[] = [];
  for (const line of lines(text)) {
    const parts = line.split(",").map((p) => p.trim());
    const [point, spec, measured, tolerance] = parts;
    const nums = [spec, measured, tolerance].map((p) => (p === undefined ? null : number(p)));
    if (parts.length !== 4 || !point || point.length > 80 || nums.some((n) => n === null || (n as number) < 0) || nums[0] === 0 || nums[1] === 0) {
      return { ok: false, problem: `Cannot read "${line.slice(0, 60)}". Write: point, spec mm, measured mm, tolerance mm.` };
    }
    found.push({ point, specMm: nums[0] as number, measuredMm: nums[1] as number, toleranceMm: nums[2] as number });
  }
  if (found.length > 60) return { ok: false, problem: "Up to 60 measurements." };
  return { ok: true, value: found };
}

/** `M 2, L 1` or `M x2` or `M:2`: pieces by size. Sizes are kept in the order written; a repeated size is added up. */
export function parseSizes(text: string): Parsed<Readonly<Record<string, number>>> {
  const out: Record<string, number> = {};
  for (const part of text.split(/[,\n;]/).map((p) => p.trim()).filter((p) => p !== "")) {
    const m = /^([^\s:]{1,16})\s*:\s*(\d{1,5})$/.exec(part) ?? /^(\S{1,16})\s+[x×]?(\d{1,5})$/i.exec(part);
    if (!m || Number(m[2]) < 1) return { ok: false, problem: `Cannot read "${part.slice(0, 30)}". Write a size and a number, such as M 2, L 1.` };
    out[m[1]!] = (out[m[1]!] ?? 0) + Number(m[2]);
  }
  const count = Object.keys(out).length;
  if (count < 1 || count > 40) return { ok: false, problem: "Give between 1 and 40 sizes." };
  return { ok: true, value: out };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** File ids, separated by spaces, commas or new lines. Up to 20. */
export function parseFileIds(text: string): Parsed<readonly string[]> {
  const ids = text.split(/[\s,;]+/).filter((p) => p !== "");
  const bad = ids.find((id) => !UUID.test(id));
  if (bad !== undefined) return { ok: false, problem: `"${bad.slice(0, 40)}" is not a file id.` };
  if (ids.length > 20) return { ok: false, problem: "Up to 20 photos." };
  return { ok: true, value: [...new Set(ids.map((i) => i.toLowerCase()))] };
}
