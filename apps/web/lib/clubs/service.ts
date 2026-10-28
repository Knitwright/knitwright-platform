import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { throwIfFailed } from "./errors";
import { kitFromRow, type Kit } from "./kit";
import { CLUB_ROLES } from "./roles";
import { playersFromRows, type Player, type StoredPlayer } from "./roster";
import type { SeasonBody } from "./schemas";

/**
 * The club in the database. Reads go through the member's own client, so row level security
 * decides what they see. Writes go through the server's client and the club functions, which check
 * the person's role themselves; the brand and the person always come from the session.
 */

const SEASON_NOT_FOUND = "That season does not exist.";
const CLUB_NOT_FOUND = "That club does not exist.";
const MEMBER_NOT_FOUND = "That member does not exist.";
const INVITATION_NOT_FOUND = "That invitation does not exist.";
const PLAYER_NOT_FOUND = "That player does not exist.";

export type Who = Readonly<{ brandId: string; userId: string }>;

export async function getKit(client: SupabaseClient, brandId: string): Promise<Kit> {
  const { data, error } = await client.from("club_kits").select("*").eq("brand_id", brandId).maybeSingle();
  throwIfFailed(error, CLUB_NOT_FOUND);
  return kitFromRow(data);
}

export async function saveKit(admin: SupabaseClient, who: Who, kit: Kit): Promise<void> {
  const { error } = await admin.rpc("save_club_kit", { p_brand_id: who.brandId, p_user_id: who.userId, p_kit: kit });
  throwIfFailed(error, CLUB_NOT_FOUND);
}

interface SeasonSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly players: number;
}

const seasonRow = z.object({
  id: z.uuid(),
  name: z.string(),
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  roster_players: z.array(z.object({ count: z.number().int() })),
});

export async function listSeasons(client: SupabaseClient, brandId: string): Promise<readonly SeasonSummary[]> {
  const { data, error } = await client
    .from("club_seasons")
    .select("id, name, starts_on, ends_on, roster_players(count)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  throwIfFailed(error, CLUB_NOT_FOUND);
  return z.array(seasonRow).parse(data ?? []).map((r) => ({ id: r.id, name: r.name, startsOn: r.starts_on, endsOn: r.ends_on, players: r.roster_players[0]?.count ?? 0 }));
}

/** Makes a season, empty, or starting from an earlier season's roster with sizes pre-filled. Returns its id. */
export async function createSeason(admin: SupabaseClient, who: Who, body: SeasonBody): Promise<string> {
  const dates = { p_starts_on: body.startsOn, p_ends_on: body.endsOn };
  const base = { p_brand_id: who.brandId, p_user_id: who.userId, p_name: body.name };
  const { data, error } = body.copyFromSeasonId
    ? await admin.rpc("start_next_season", { ...base, ...dates, p_from_season_id: body.copyFromSeasonId })
    : await admin.rpc("create_club_season", { ...base, ...dates });
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z.uuid().parse(data);
}

export async function deleteSeason(admin: SupabaseClient, who: Who, seasonId: string): Promise<void> {
  const { error } = await admin.rpc("delete_club_season", { p_brand_id: who.brandId, p_user_id: who.userId, p_season_id: seasonId });
  throwIfFailed(error, SEASON_NOT_FOUND);
}

export async function getRoster(client: SupabaseClient, brandId: string, seasonId: string): Promise<readonly StoredPlayer[]> {
  const season = await client.from("club_seasons").select("id").eq("id", seasonId).eq("brand_id", brandId).maybeSingle();
  throwIfFailed(season.error, SEASON_NOT_FOUND);
  if (!season.data) throw new AppError("not_found", SEASON_NOT_FOUND);
  const { data, error } = await client
    .from("roster_players")
    .select("id, name, number, size_label, wearer_group")
    .eq("season_id", seasonId)
    .eq("brand_id", brandId)
    .order("position", { ascending: true })
    .limit(1000);
  throwIfFailed(error, SEASON_NOT_FOUND);
  return playersFromRows(data);
}

/** Replaces every player of a season in one step. */
export async function replaceRoster(admin: SupabaseClient, who: Who, seasonId: string, players: readonly Player[]): Promise<number> {
  const { data, error } = await admin.rpc("replace_season_roster", { p_brand_id: who.brandId, p_user_id: who.userId, p_season_id: seasonId, p_players: players });
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z.number().int().parse(data);
}

/** Erases one player, for someone who asks to be forgotten. */
export async function erasePlayer(admin: SupabaseClient, who: Who, playerId: string): Promise<void> {
  const { error } = await admin.rpc("erase_roster_player", { p_brand_id: who.brandId, p_user_id: who.userId, p_player_id: playerId });
  throwIfFailed(error, PLAYER_NOT_FOUND);
}

export interface Member {
  readonly userId: string;
  readonly role: (typeof CLUB_ROLES)[number];
  readonly name: string;
}

const memberRow = z.object({ user_id: z.uuid(), role: z.enum(CLUB_ROLES), name: z.string().nullable() });

export async function listMembers(client: SupabaseClient, brandId: string): Promise<readonly Member[]> {
  const { data, error } = await client.rpc("club_members", { p_brand_id: brandId });
  throwIfFailed(error, CLUB_NOT_FOUND);
  return z.array(memberRow).parse(data ?? []).map((r) => ({ userId: r.user_id, role: r.role, name: r.name ?? "A member" }));
}

export async function setMemberRole(admin: SupabaseClient, who: Who, targetId: string, role: string): Promise<void> {
  const { error } = await admin.rpc("set_member_role", { p_brand_id: who.brandId, p_user_id: who.userId, p_target_id: targetId, p_role: role });
  throwIfFailed(error, MEMBER_NOT_FOUND);
}

export async function removeMember(admin: SupabaseClient, who: Who, targetId: string): Promise<void> {
  const { error } = await admin.rpc("remove_member", { p_brand_id: who.brandId, p_user_id: who.userId, p_target_id: targetId });
  throwIfFailed(error, MEMBER_NOT_FOUND);
}

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: string;
}

const invitationRow = z.object({ id: z.uuid(), email: z.string(), role: z.string() });

/** Only people who manage members can read these; for anyone else the database returns none. */
export async function listInvitations(client: SupabaseClient, brandId: string): Promise<readonly Invitation[]> {
  const { data, error } = await client.from("club_invitations").select("id, email, role").eq("brand_id", brandId).order("created_at", { ascending: true }).limit(100);
  throwIfFailed(error, CLUB_NOT_FOUND);
  return z.array(invitationRow).parse(data ?? []);
}

export async function inviteMember(admin: SupabaseClient, who: Who, email: string, role: string): Promise<void> {
  const { error } = await admin.rpc("invite_member", { p_brand_id: who.brandId, p_user_id: who.userId, p_email: email, p_role: role });
  throwIfFailed(error, CLUB_NOT_FOUND);
}

export async function cancelInvitation(admin: SupabaseClient, who: Who, invitationId: string): Promise<void> {
  const { error } = await admin.rpc("cancel_invitation", { p_brand_id: who.brandId, p_user_id: who.userId, p_invitation_id: invitationId });
  throwIfFailed(error, INVITATION_NOT_FOUND);
}

interface MyInvitation {
  readonly id: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly role: string;
}

const myInvitationRow = z.object({ id: z.uuid(), brand_id: z.uuid(), brand_name: z.string(), role: z.string() });

/** Invitations that name the signed-in person's own confirmed address. */
export async function myInvitations(client: SupabaseClient): Promise<readonly MyInvitation[]> {
  const { data, error } = await client.rpc("my_club_invitations");
  throwIfFailed(error, INVITATION_NOT_FOUND);
  return z.array(myInvitationRow).parse(data ?? []).map((r) => ({ id: r.id, brandId: r.brand_id, brandName: r.brand_name, role: r.role }));
}

/** Joins the club the invitation is for. Returns the club's id. */
export async function acceptInvitation(admin: SupabaseClient, userId: string, invitationId: string): Promise<string> {
  const { data, error } = await admin.rpc("accept_invitation", { p_user_id: userId, p_invitation_id: invitationId });
  throwIfFailed(error, INVITATION_NOT_FOUND);
  return z.uuid().parse(data);
}

interface OrderHistoryEntry {
  readonly releaseId: string;
  readonly projectId: string;
  readonly designName: string;
  readonly number: number;
  readonly label: string;
  readonly createdAt: string;
}

const releaseRow = z.object({ id: z.uuid(), project_id: z.uuid(), number: z.number().int(), label: z.string(), created_at: z.string() });
const projectName = z.object({ id: z.uuid(), name: z.string() });

/** The club's frozen releases, newest first, with the design each is for. Read only. */
export async function listOrderHistory(client: SupabaseClient, brandId: string): Promise<readonly OrderHistoryEntry[]> {
  const { data, error } = await client
    .from("production_releases")
    .select("id, project_id, number, label, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  throwIfFailed(error, CLUB_NOT_FOUND);
  const releases = z.array(releaseRow).parse(data ?? []);
  if (releases.length === 0) return [];
  const ids = [...new Set(releases.map((r) => r.project_id))];
  const named = await client.from("projects").select("id, name").eq("brand_id", brandId).in("id", ids);
  throwIfFailed(named.error, CLUB_NOT_FOUND);
  const names = new Map(z.array(projectName).parse(named.data ?? []).map((p) => [p.id, p.name]));
  return releases.map((r) => ({ releaseId: r.id, projectId: r.project_id, designName: names.get(r.project_id) ?? "A deleted design", number: r.number, label: r.label, createdAt: r.created_at }));
}
