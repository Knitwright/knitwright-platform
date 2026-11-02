import { MARKETING_RULE } from "../rules";
import type { ColourSpace, FileFormat } from "./targets";

/**
 * RGB AND CMYK, AND WHY CMYK IS SERVER-SIDE (spec F-L2: colour "RGB (web)" or "CMYK (print)";
 * plan v5 L4, decision 0094).
 *
 * The decision, written out because the plan asks for it on the pull request and in the record:
 *
 * **CMYK is separated server-side by the library the platform already ships, and only against a
 * colour profile somebody has put on file. No profile is on file, so the panel refuses CMYK and
 * says why.**
 *
 *   * The conversion itself needs no new dependency: `sharp` (Apache-2.0) is already in the lock
 *     file, and the libvips it carries does ICC transforms through Little CMS (MIT). So the code to
 *     do this honestly exists; what is missing is the *profile*.
 *   * A CMYK separation is meaningless without one. The usual profiles (Adobe's, the ECI and FOGRA
 *     sets) are **not** redistributable under MIT, BSD or Apache, and the plan's rule is that no
 *     third-party asset is committed. So no profile ships here, and none is invented.
 *   * A naive conversion -- 255 minus each channel, with the black pulled out -- would produce a
 *     file that opens, prints, and is wrong, with no warning to the person who sent it to a press.
 *     That is exactly the thing the UI bar forbids: "say plainly when a chosen target cannot be met
 *     rather than exporting something wrong".
 *
 * A browser library was not chosen for the same reason: the cost is not the maths, it is the
 * licensed profile, and doing it in a page would also mean shipping one.
 */

/** A colour profile a platform admin has put on file, which nothing here invents. */
export interface CmykProfile {
  /** What the profile is called, which goes in the file and in the panel's own note. */
  readonly name: string;
  /** Where the bytes are, in our own storage. No bytes cross this seam. */
  readonly fileId: string;
}

/** Where a profile is read from. Nothing implements it yet, which is the point. */
export interface CmykProfileSource {
  read(): Promise<CmykProfile | null>;
}

/** The source until somebody puts a profile on file: it answers that there is none. */
export const noCmykProfile: CmykProfileSource = { read: async () => null };

/** The formats that can carry a separation at all. */
export const CMYK_FORMATS: readonly FileFormat[] = ["jpeg", "pdf"];

export const WHY_NO_CMYK =
  "No colour profile is on file, so this file cannot be separated for a press. Export it as RGB, or ask us to put a profile on file.";

export type ColourVerdict = Readonly<{ ok: true; space: ColourSpace; profile: CmykProfile | null }> | Readonly<{ ok: false; reason: string; ruleId: string }>;

/**
 * Whether a file can be made in the colour space asked for. RGB always can. CMYK can only with a
 * profile on file and in a format that carries one.
 */
export function colourVerdict(space: ColourSpace, format: FileFormat, profile: CmykProfile | null): ColourVerdict {
  if (space === "rgb") return { ok: true, space, profile: null };
  if (!CMYK_FORMATS.includes(format)) {
    return { ok: false, reason: "A CMYK file is a JPEG or a PDF. Choose one of those, or export this as RGB.", ruleId: MARKETING_RULE };
  }
  if (profile === null) return { ok: false, reason: WHY_NO_CMYK, ruleId: MARKETING_RULE };
  return { ok: true, space, profile };
}

/** What the panel says under the colour choice, so the reason is on the screen and not only in a record. */
export const colourNote = (space: ColourSpace, profile: CmykProfile | null): string =>
  space === "rgb"
    ? "RGB, which is what a screen shows."
    : profile === null
      ? WHY_NO_CMYK
      : `Separated against ${profile.name}, on the server.`;
