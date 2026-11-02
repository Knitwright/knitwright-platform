import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { WEARER_GROUPS } from "../wording";
import { throwIfFailed } from "../errors";
import type { Who } from "../service";
import type { ChaseTemplate } from "./chase";
import type { SignupEntry, SignupRequest } from "./grid";
import type { NumberRule } from "./numbers";
import type { PastedPerson } from "./paste";
import type { ZoneLimit } from "./zones";
import { isZone } from "./zones";

/**
 * Roster sign-up in the database (spec F-T4, plan v5 Z7, decision 0087). Writes, and every read
 * made with a token, go through the sign-up functions, which only the server's own key may run and
 * which check the person's role or the token themselves. A club's own lists are read through the
 * member's client, so row level security decides what they see.
 */

const SEASON_NOT_FOUND = "That season does not exist.";
export const LINK_NOT_FOUND = "That link does not exist.";

const ROWS_LISTED = 500;

const linkRow = z.object({
  id: z.uuid(),
  season_id: z.uuid(),
  sport: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});
const requestRow = z.object({ id: z.uuid(), name: z.string(), phone: z.string(), email: z.string() });
const entryRow = z.object({
  id: z.uuid(),
  name_on_shirt: z.string(),
  number: z.string(),
  size_label: z.string(),
  wearer_group: z.enum(WEARER_GROUPS),
  updated_at: z.string(),
});
const numberRuleRow = z.object({
  sport: z.string(),
  label: z.string(),
  lowest: z.number().int(),
  highest: z.number().int(),
  leading_zero_allowed: z.boolean(),
  rule_id: z.string(),
  note: z.string(),
});
const zoneRow = z.object({ zone: z.string(), label: z.string(), max_characters: z.number().int(), rule_id: z.string(), note: z.string() });
const templateRow = z.object({ id: z.string(), channel: z.enum(["whatsapp", "email"]), subject: z.string(), body: z.string(), note: z.string() });

export interface SignupLink {
  readonly id: string;
  readonly seasonId: string;
  readonly sport: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface NewSignupLink {
  readonly id: string;
  readonly expiresAt: string;
  readonly token: string;
}

const createdRow = z.object({ id: z.uuid(), expires_at: z.string() });

/** Makes the season's sign-up link, which withdraws the one before it. */
export async function createSignupLink(
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ seasonId: string; token: string; sport: string }>,
): Promise<NewSignupLink> {
  const { data, error } = await admin.rpc("create_roster_signup_link", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_season_id: input.seasonId,
    p_token: input.token,
    p_sport: input.sport,
  });
  throwIfFailed(error, SEASON_NOT_FOUND);
  const row = createdRow.parse(Array.isArray(data) ? data[0] : data);
  return { id: row.id, expiresAt: row.expires_at, token: input.token };
}

export async function revokeSignupLink(admin: SupabaseClient, who: Who, linkId: string): Promise<void> {
  const { error } = await admin.rpc("revoke_roster_signup_link", { p_link_id: linkId, p_user_id: who.userId });
  throwIfFailed(error, LINK_NOT_FOUND);
}

/** Replaces the list of people the club is waiting on. Returns how many are on it. */
export async function setRequests(admin: SupabaseClient, who: Who, seasonId: string, people: readonly PastedPerson[]): Promise<number> {
  const { data, error } = await admin.rpc("set_roster_signup_requests", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_season_id: seasonId,
    p_people: people.map((person) => ({ name: person.name, phone: person.phone, email: person.email })),
  });
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z.number().int().parse(data);
}

export interface SeasonSignup {
  readonly seasonName: string;
  readonly link: SignupLink | null;
  readonly requests: readonly SignupRequest[];
  readonly entries: readonly SignupEntry[];
}

/** The season's open link, the people it is waiting on and the answers so far, read as the member. */
export async function readSeasonSignup(client: SupabaseClient, brandId: string, seasonId: string): Promise<SeasonSignup> {
  const [season, links, requests, entries] = await Promise.all([
    client.from("club_seasons").select("name").eq("brand_id", brandId).eq("id", seasonId).maybeSingle(),
    client
      .from("roster_signup_links")
      .select("id, season_id, sport, created_at, expires_at, revoked_at")
      .eq("brand_id", brandId)
      .eq("season_id", seasonId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    client.from("roster_signup_requests").select("id, name, phone, email").eq("brand_id", brandId).eq("season_id", seasonId).order("name").limit(ROWS_LISTED),
    client
      .from("roster_signup_entries")
      .select("id, name_on_shirt, number, size_label, wearer_group, updated_at")
      .eq("brand_id", brandId)
      .eq("season_id", seasonId)
      .order("created_at")
      .limit(ROWS_LISTED),
  ]);
  for (const result of [season, links, requests, entries]) throwIfFailed(result.error, SEASON_NOT_FOUND);
  const parsedLink = z.array(linkRow).parse(links.data ?? [])[0];
  return {
    seasonName: z.object({ name: z.string() }).safeParse(season.data).data?.name ?? "",
    link: parsedLink
      ? {
          id: parsedLink.id,
          seasonId: parsedLink.season_id,
          sport: parsedLink.sport,
          createdAt: parsedLink.created_at,
          expiresAt: parsedLink.expires_at,
          revokedAt: parsedLink.revoked_at,
        }
      : null,
    requests: z.array(requestRow).parse(requests.data ?? []),
    entries: z
      .array(entryRow)
      .parse(entries.data ?? [])
      .map((row) => ({
        id: row.id,
        nameOnShirt: row.name_on_shirt,
        number: row.number,
        sizeLabel: row.size_label,
        wearerGroup: row.wearer_group,
        updatedAt: row.updated_at,
      })),
  };
}

/** The number rules, read with the server's own key: no browser role reaches the table at all. */
export async function readNumberRules(admin: SupabaseClient): Promise<readonly NumberRule[]> {
  const { data, error } = await admin.from("sport_number_rules").select("sport, label, lowest, highest, leading_zero_allowed, rule_id, note").order("sport");
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z
    .array(numberRuleRow)
    .parse(data ?? [])
    .map((row) => ({
      sport: row.sport,
      label: row.label,
      lowest: row.lowest,
      highest: row.highest,
      leadingZeroAllowed: row.leading_zero_allowed,
      ruleId: row.rule_id,
      note: row.note,
    }));
}

export async function readZoneLimits(admin: SupabaseClient): Promise<readonly ZoneLimit[]> {
  const { data, error } = await admin.from("shirt_zone_limits").select("zone, label, max_characters, rule_id, note").order("zone");
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z
    .array(zoneRow)
    .parse(data ?? [])
    .flatMap((row) =>
      isZone(row.zone) ? [{ zone: row.zone, label: row.label, maxCharacters: row.max_characters, ruleId: row.rule_id, note: row.note }] : [],
    );
}

export async function readChaseTemplates(admin: SupabaseClient): Promise<readonly ChaseTemplate[]> {
  const { data, error } = await admin.from("chase_templates").select("id, channel, subject, body, note").order("id");
  throwIfFailed(error, SEASON_NOT_FOUND);
  return z.array(templateRow).parse(data ?? []);
}

export interface SubmitInput {
  readonly token: string;
  readonly visitorKey: string;
  readonly name: string;
  readonly number: string;
  readonly sizeLabel: string;
  readonly wearerGroup: string;
}

/** Keeps one player's answer, replacing what the same browser sent before through the same link. */
export async function submitSignup(admin: SupabaseClient, input: SubmitInput): Promise<void> {
  const { error } = await admin.rpc("roster_signup_submit", {
    p_token: input.token,
    p_visitor_key: input.visitorKey,
    p_name: input.name,
    p_number: input.number,
    p_size_label: input.sizeLabel,
    p_wearer_group: input.wearerGroup,
  });
  throwIfFailed(error, LINK_NOT_FOUND);
}

const openRow = z.object({
  link_id: z.uuid(),
  brand_id: z.uuid(),
  club_name: z.string(),
  season_name: z.string(),
  expires_at: z.string(),
  sport: z.string(),
  sport_label: z.string(),
  lowest: z.number().int(),
  highest: z.number().int(),
  leading_zero_allowed: z.boolean(),
  number_rule_id: z.string(),
  name_max_characters: z.number().int(),
  name_rule_id: z.string(),
});

export interface OpenSignup {
  readonly linkId: string;
  readonly brandId: string;
  readonly clubName: string;
  readonly seasonName: string;
  readonly expiresAt: string;
  readonly numberRule: NumberRule;
  readonly nameMaxCharacters: number;
  readonly nameRuleId: string;
}

/**
 * The link a token opens, or null for a token that is malformed, unknown, expired or revoked. All
 * of those take the same path through the database and give the same answer. Nothing about another
 * player, nothing about the roster and nothing about the club's designs comes back.
 */
export async function openSignup(admin: SupabaseClient, token: string): Promise<OpenSignup | null> {
  const { data, error } = await admin.rpc("open_roster_signup", { p_token: token });
  throwIfFailed(error, LINK_NOT_FOUND);
  const row = z.array(openRow).parse(data ?? [])[0];
  if (!row) return null;
  return {
    linkId: row.link_id,
    brandId: row.brand_id,
    clubName: row.club_name,
    seasonName: row.season_name,
    expiresAt: row.expires_at,
    numberRule: {
      sport: row.sport,
      label: row.sport_label,
      lowest: row.lowest,
      highest: row.highest,
      leadingZeroAllowed: row.leading_zero_allowed,
      ruleId: row.number_rule_id,
      note: "",
    },
    nameMaxCharacters: row.name_max_characters,
    nameRuleId: row.name_rule_id,
  };
}
