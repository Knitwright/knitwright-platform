import type { ClubRole } from "@/lib/clubs/roles";
import type { WearerGroup } from "@/lib/clubs/wording";

export type KitView = Readonly<{
  primaryColour: string | null;
  secondaryColour: string | null;
  accentColour: string | null;
  crestFileId: string | null;
  sponsors: readonly Readonly<{ name: string; logoFileId: string | null }>[];
}>;

/** A picture the club has already uploaded, to choose as a crest or a sponsor logo. */
export type PictureChoice = Readonly<{ fileId: string; label: string }>;

export type MemberView = Readonly<{ userId: string; role: ClubRole; name: string }>;
export type InvitationView = Readonly<{ id: string; email: string; role: string }>;
export type SeasonView = Readonly<{ id: string; name: string; startsOn: string | null; endsOn: string | null; players: number }>;

export type PlayerRow = Readonly<{ key: string; id?: string; name: string; number: string; sizeLabel: string; wearerGroup: WearerGroup }>;
