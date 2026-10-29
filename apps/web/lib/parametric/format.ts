/**
 * Number formats of the reference script, so the review files come out byte for byte the same.
 * The script ran on Windows PowerShell (.NET Framework), which first takes a double to 15
 * significant digits and then rounds half away from zero. The rounding is done on the digit
 * string, not in arithmetic, because the project targets ES2017 and has no BigInt.
 */

/**
 * The magnitude as a plain decimal string of 15 significant digits. Pattern coordinates are
 * millimetres, so a magnitude at or above 1e15 mm is a bug rather than a coordinate.
 */
function fifteenDigits(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e15) throw new Error(`Out of range for a millimetre coordinate: ${v}`);
  const s = abs.toPrecision(15);
  // Magnitudes below 1e-7 come back in exponential form; either way they are zero at two places.
  return s.includes("e") ? "0" : s;
}

/** One added to the last digit of a string of decimal digits, carrying into a new leading digit. */
function increment(digits: string): string {
  const out = digits.split("");
  let i = out.length - 1;
  for (; i >= 0; i--) {
    if (out[i] === "9") {
      out[i] = "0";
      continue;
    }
    out[i] = String(Number(out[i]) + 1);
    break;
  }
  return i < 0 ? `1${out.join("")}` : out.join("");
}

/** The script's `F`: `ToString('0.##')`, at most two decimals, no trailing zeros, never "-0". */
export function f2(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`Not a finite number: ${v}`);
  const [whole, frac = ""] = fifteenDigits(v).split(".");
  const padded = frac.padEnd(3, "0");
  const carried = padded[2] >= "5";
  const digits = carried ? increment(whole + padded.slice(0, 2)) : whole + padded.slice(0, 2);
  const int = digits.slice(0, -2).replace(/^0+(?=\d)/, "");
  const rest = digits.slice(-2).replace(/0+$/, "");
  if (int === "0" && rest === "") return "0";
  return `${v < 0 ? "-" : ""}${int}${rest ? `.${rest}` : ""}`;
}

/** A double dropped into a PowerShell string as is: up to 15 significant digits. */
export function g15(v: number): string {
  return String(Number(v.toPrecision(15)));
}
