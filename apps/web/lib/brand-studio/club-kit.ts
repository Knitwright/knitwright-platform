/**
 * The club kit, READ THROUGH into Brand Studio. Nothing is copied and nothing is migrated.
 *
 * WHY READ THROUGH, NOT MIGRATED (decision 0079). `club_kits` is still live: `/club` writes it
 * through `save_club_kit`, `lib/clubs/apply-kit.ts` applies it to a design, the reorder flow reads
 * it and `lib/deletion/team-data.ts` erases it. Copying its colours and crest into
 * `brand_studio_*` would leave two rows that mean the same thing and drift apart the first time
 * somebody edited one of them, and a club would then see different colours on `/club` and in Brand
 * Studio. So Brand Studio reads `club_kits` every time and shows what it finds as a palette and as
 * Sportswear pictures it does not own: present, labelled, counted towards the completion %, and
 * still edited in the one place that writes them. Nothing can be lost, because nothing moved.
 *
 * A structural type is used rather than `lib/clubs/kit.ts` so this file carries no schema library
 * into a browser bundle.
 */

import type { BrandAsset, BrandPalette } from "./types";

/** What this file needs of a club kit. The shape of `Kit` in `lib/clubs/kit.ts`. */
export interface ClubKitFacts {
  readonly primaryColour: string | null;
  readonly secondaryColour: string | null;
  readonly accentColour: string | null;
  readonly crestFileId: string | null;
  readonly sponsors: readonly Readonly<{ name: string; logoFileId: string | null }>[];
}

/** Said on everything read through, so nobody edits it in the wrong place. */
export const CLUB_KIT_NOTE = "From your club kit. Change it on the Club page.";

export const CLUB_KIT_PALETTE_ID = "club-kit";

const CLUB_COLOURS = [
  ["primaryColour", "club-primary", "Main colour"],
  ["secondaryColour", "club-secondary", "Second colour"],
  ["accentColour", "club-accent", "Accent colour"],
] as const satisfies readonly (readonly [keyof ClubKitFacts, string, string])[];

/**
 * The club kit's colours as one read-only palette, or null when the club has chosen none. The names
 * are the ones `/club` already shows, so a club reads the same words in both places.
 */
export function clubKitPalette(kit: ClubKitFacts): BrandPalette | null {
  const colours = CLUB_COLOURS.flatMap(([field, id, name]) => {
    const hex = kit[field];
    return typeof hex === "string" && hex !== "" ? [{ id, name, hex: hex.toLowerCase(), pantoneTcx: null }] : [];
  });
  if (colours.length === 0) return null;
  return { id: CLUB_KIT_PALETTE_ID, name: "Club kit", colours, source: "club-kit" };
}

/** The club kit's crest and sponsor logos as read-only Sportswear pictures. A sponsor with no logo has no picture. */
export function clubKitAssets(kit: ClubKitFacts): readonly BrandAsset[] {
  const crest: readonly BrandAsset[] =
    kit.crestFileId === null
      ? []
      : [{ id: "club-crest", kind: "crest", artworkId: kit.crestFileId, label: "Crest", sponsorName: null, printWidthMm: null, source: "club-kit" }];
  const sponsors = kit.sponsors.flatMap((sponsor, at) =>
    sponsor.logoFileId === null
      ? []
      : [
          {
            id: `club-sponsor-${at}`,
            kind: "sponsor" as const,
            artworkId: sponsor.logoFileId,
            label: sponsor.name === "" ? `Sponsor ${at + 1}` : sponsor.name,
            sponsorName: sponsor.name === "" ? null : sponsor.name,
            printWidthMm: null,
            source: "club-kit" as const,
          },
        ],
  );
  return [...crest, ...sponsors];
}

/** Whether anything at all is read through, so a tab can say where its contents came from. */
export const hasClubKit = (kit: ClubKitFacts): boolean => clubKitPalette(kit) !== null || clubKitAssets(kit).length > 0;
