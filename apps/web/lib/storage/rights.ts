import { LOGO_RIGHTS } from "@/lib/consent/wording";
import type { ImageKind } from "./store";

/**
 * Artwork goes on a garment, so the person must confirm they own it or may use it there
 * (guide p.14: "Rights checkbox at upload"). A sketch or photo is only read to start a
 * design and never printed, so it needs no confirmation.
 */

export const LOGO_RIGHTS_MISSING =
  "Tick the box to confirm you own this logo or have permission to use it on garments. Nothing was uploaded.";

/** What is kept with the file: who confirmed, when, and the version of the words they saw. */
export type LogoRights = Readonly<{ confirmedBy: string; confirmedAt: string; wordingVersion: string }>;

export type RightsCheck = Readonly<{ ok: true; rights: LogoRights | null }> | Readonly<{ ok: false; message: string }>;

export const logoRightsFor = (input: Readonly<{ kind: ImageKind; confirmed: boolean; userId: string; now: Date }>): RightsCheck => {
  if (input.kind !== "artwork") return { ok: true, rights: null };
  if (!input.confirmed) return { ok: false, message: LOGO_RIGHTS_MISSING };
  return {
    ok: true,
    rights: { confirmedBy: input.userId, confirmedAt: input.now.toISOString(), wordingVersion: LOGO_RIGHTS.version },
  };
};
