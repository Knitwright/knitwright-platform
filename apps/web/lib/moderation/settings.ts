/**
 * The numbers the screens use. All are Knitwright defaults, set without real uploads to tune them against (decision 0073, owner
 * questions). They live here, in one place, so a later settings console can pass others in.
 */
export const SETTINGS_LABEL = "Knitwright default, not tuned on real uploads";

export type ModerationSettings = Readonly<{
  /** Image hashes this close (bits of the hash's 128) to a registered mark block the upload. */
  imageBlockDistance: number;
  /** Image hashes this close flag the upload for a person. */
  imageFlagDistance: number;
  /** Upheld takedown notices at which a brand counts as a repeat infringer. */
  repeatInfringerStrikes: number;
}>;

/**
 * The distances come from the measurements in `image.test.ts`: the same mark resized, recoloured or re-saved as a JPEG stayed
 * within 2 bits of 128, and a different picture was 52 bits away. 8 and 20 sit in that gap with room on both sides. They have
 * not been measured on real uploads (owner question 1 of decision 0073).
 */
export const DEFAULT_SETTINGS: ModerationSettings = {
  imageBlockDistance: 8,
  imageFlagDistance: 20,
  repeatInfringerStrikes: 3,
};
