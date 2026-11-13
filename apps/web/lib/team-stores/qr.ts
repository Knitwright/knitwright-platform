import qrcode from "qrcode-generator";

/**
 * The QR code a club prints or shows for its team store (plan v6 C2, decision 0153; spec F-T6 "a short link or QR
 * code"). Made with `qrcode-generator` (MIT) as one SVG path of dark squares, so the page draws it with its own
 * colour tokens and nothing is fetched. Medium error correction, the usual choice for a printed poster.
 */

export interface QrPath {
  /** Modules on each side, without the quiet zone. */
  readonly size: number;
  /** One path of 1×1 squares in module units, offset by the quiet zone. */
  readonly d: string;
  /** The side of the viewBox, quiet zone included. */
  readonly box: number;
}

/** The four-module quiet zone the QR standard asks for around the code. */
export const QUIET_ZONE = 4;

export function qrPath(text: string): QrPath {
  const code = qrcode(0, "M");
  code.addData(text, "Byte");
  code.make();
  const size = code.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (code.isDark(row, col)) parts.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return { size, d: parts.join(""), box: size + QUIET_ZONE * 2 };
}
