import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { COMMITTEE_SLOTS, type CommitteeSlot } from "./fields";
import type { CommitteeApproval, CommitteePin, CommitteeVote } from "./tally";

/**
 * Committee links in the database (spec F-T3, plan v5 Z7, decision 0087). Writes, and every read
 * made with a token, go through the committee functions, which only the server's own key may run
 * and which check the member's role or the token themselves. A club's own lists are read through
 * the member's client, so the database's rules decide what they see. The brand always comes from
 * the session or the token, never from a form.
 */

export const LINK_NOT_FOUND = "That link does not exist.";
const DESIGN_NOT_FOUND = "That design does not exist.";

/** The most links, pins, votes and approvals read for one design at once. */
const LINKS_LISTED = 50;
const ROWS_LISTED = 500;

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }> | null;

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_links: "This design has as many committee links as it may have. Withdraw one first.",
  too_many_pins: "This link has taken as many comments as it can.",
  too_many_votes: "This link has taken as many votes as it can.",
  already_locked: "A version of this design is already locked. Nothing else can be locked against it.",
  not_checked: "This version has not been checked against a factory profile yet. Run the checks, then lock it.",
  append_only: "A committee comment, vote record, approval or lock is a record and never changes.",
};

/** What the committee functions raise, as a failure a person may read. Unknown faults say nothing more. */
export const committeeFailure = (error: NonNullable<DatabaseError>, notFound: string): AppError => {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "42501":
      return new AppError("forbidden", "Your role in this club does not allow that.");
    case "P0002":
    case "22P02":
      return new AppError("not_found", notFound);
    case "22023":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

const throwIf = (error: DatabaseError, notFound: string): void => {
  if (error) throw committeeFailure(error, notFound);
};

const slot = z.enum(COMMITTEE_SLOTS);
const createdRow = z.object({ id: z.uuid(), expires_at: z.string() });

export interface NewCommitteeLink {
  readonly id: string;
  readonly expiresAt: string;
  /** Shown to the member once. Only its hash is stored. */
  readonly token: string;
}

/** Makes a link showing the given versions as options A, B and C, in the order given. */
export async function createCommitteeLink(
  admin: SupabaseClient,
  input: Readonly<{ projectId: string; userId: string; token: string; versions: readonly number[] }>,
): Promise<NewCommitteeLink> {
  const { data, error } = await admin.rpc("create_committee_link", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_token: input.token,
    p_versions: [...input.versions],
  });
  throwIf(error, DESIGN_NOT_FOUND);
  const row = createdRow.parse(Array.isArray(data) ? data[0] : data);
  return { id: row.id, expiresAt: row.expires_at, token: input.token };
}

export async function revokeCommitteeLink(admin: SupabaseClient, input: Readonly<{ linkId: string; userId: string }>): Promise<void> {
  const { error } = await admin.rpc("revoke_committee_link", { p_link_id: input.linkId, p_user_id: input.userId });
  throwIf(error, LINK_NOT_FOUND);
}

/** Locks one version, which moves it to status approved. Returns the lock's own id. */
export async function lockCommitteeVersion(
  admin: SupabaseClient,
  input: Readonly<{ linkId: string; userId: string; version: number }>,
): Promise<string> {
  const { data, error } = await admin.rpc("committee_lock_version", {
    p_link_id: input.linkId,
    p_user_id: input.userId,
    p_version: input.version,
  });
  throwIf(error, LINK_NOT_FOUND);
  return z.uuid().parse(data);
}

/** What a token opens: one row per option the link shows. */
const openRow = z.object({
  link_id: z.uuid(),
  brand_id: z.uuid(),
  brand_name: z.string(),
  project_name: z.string(),
  expires_at: z.string(),
  slot,
  version: z.number().int(),
  is_current: z.boolean(),
  spec: z.unknown(),
  saved_at: z.string(),
  locked_version: z.number().int().nullable(),
});

export interface OpenCommitteeOption {
  readonly slot: CommitteeSlot;
  readonly version: number;
  readonly isCurrent: boolean;
  readonly spec: unknown;
  readonly savedAt: string;
}

export interface OpenCommittee {
  readonly linkId: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly projectName: string;
  readonly expiresAt: string;
  /** The version the club has already locked, or null. A locked design is read only to everyone. */
  readonly lockedVersion: number | null;
  readonly options: readonly OpenCommitteeOption[];
}

/**
 * The link a token opens, or null for a token that is malformed, unknown, expired or revoked. All
 * of those take the same path through the database and give the same answer.
 */
export async function openCommittee(admin: SupabaseClient, token: string): Promise<OpenCommittee | null> {
  const { data, error } = await admin.rpc("open_committee", { p_token: token });
  throwIf(error, LINK_NOT_FOUND);
  const rows = z.array(openRow).parse(data ?? []);
  const first = rows[0];
  if (!first) return null;
  return {
    linkId: first.link_id,
    brandId: first.brand_id,
    brandName: first.brand_name,
    projectName: first.project_name,
    expiresAt: first.expires_at,
    lockedVersion: first.locked_version,
    options: rows.map((row) => ({
      slot: row.slot,
      version: row.version,
      isCurrent: row.is_current,
      spec: row.spec,
      savedAt: row.saved_at,
    })),
  };
}

export interface PinInput {
  readonly token: string;
  readonly visitorKey: string;
  readonly name: string;
  readonly version: number;
  readonly panelId: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly body: string;
}

export async function pinComment(admin: SupabaseClient, input: PinInput): Promise<void> {
  const { error } = await admin.rpc("committee_pin", {
    p_token: input.token,
    p_visitor_key: input.visitorKey,
    p_name: input.name,
    p_version: input.version,
    p_panel_id: input.panelId,
    p_x_mm: input.xMm,
    p_y_mm: input.yMm,
    p_body: input.body,
  });
  throwIf(error, LINK_NOT_FOUND);
}

export async function castVote(
  admin: SupabaseClient,
  input: Readonly<{ token: string; visitorKey: string; name: string; slot: CommitteeSlot }>,
): Promise<void> {
  const { error } = await admin.rpc("committee_vote", {
    p_token: input.token,
    p_visitor_key: input.visitorKey,
    p_name: input.name,
    p_slot: input.slot,
  });
  throwIf(error, LINK_NOT_FOUND);
}

/** Records an approval and returns its id. Pressing Approve again on the same version changes nothing. */
export async function recordApproval(
  admin: SupabaseClient,
  input: Readonly<{ token: string; visitorKey: string; name: string; email: string | null; version: number }>,
): Promise<string> {
  const { data, error } = await admin.rpc("committee_approve", {
    p_token: input.token,
    p_visitor_key: input.visitorKey,
    p_name: input.name,
    p_email: input.email,
    p_version: input.version,
  });
  throwIf(error, LINK_NOT_FOUND);
  return z.uuid().parse(data);
}

const linkRow = z.object({
  id: z.uuid(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});
const versionRow = z.object({ link_id: z.uuid(), slot, version: z.number().int() });
const pinRow = z.object({
  id: z.uuid(),
  link_id: z.uuid(),
  version: z.number().int(),
  name: z.string(),
  panel_id: z.string(),
  x_mm: z.coerce.number(),
  y_mm: z.coerce.number(),
  body: z.string(),
  created_at: z.string(),
});
const voteRow = z.object({ link_id: z.uuid(), slot, name: z.string(), updated_at: z.string() });
const approvalRow = z.object({
  id: z.uuid(),
  link_id: z.uuid(),
  version: z.number().int(),
  name: z.string(),
  email: z.string().nullable(),
  approved_at: z.string(),
});
const lockRow = z.object({ version: z.number().int(), locked_at: z.string(), approval_id: z.uuid().nullable() });

export interface CommitteeLink {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly slots: readonly Readonly<{ slot: CommitteeSlot; version: number }>[];
  readonly pins: readonly CommitteePin[];
  readonly votes: readonly CommitteeVote[];
  readonly approvals: readonly CommitteeApproval[];
}

export interface CommitteeLock {
  readonly version: number;
  readonly lockedAt: string;
  readonly approvalId: string | null;
}

export interface CommitteeOfDesign {
  readonly links: readonly CommitteeLink[];
  readonly lock: CommitteeLock | null;
}

interface Collected {
  readonly allVersions: readonly z.output<typeof versionRow>[];
  readonly allPins: readonly z.output<typeof pinRow>[];
  readonly allVotes: readonly z.output<typeof voteRow>[];
  readonly allApprovals: readonly z.output<typeof approvalRow>[];
}

/** What the given links collected: their options, pins, votes and approvals, read as the member. */
async function collectedFor(client: SupabaseClient, brandId: string, ids: readonly string[]): Promise<Collected> {
  const read = (table: string, columns: string, order: string) =>
    client.from(table).select(columns).eq("brand_id", brandId).in("link_id", [...ids]).order(order, { ascending: true }).limit(ROWS_LISTED);
  const [versions, pins, votes, approvals] = await Promise.all([
    read("committee_link_versions", "link_id, slot, version", "slot"),
    read("committee_pins", "id, link_id, version, name, panel_id, x_mm, y_mm, body, created_at", "created_at"),
    read("committee_votes", "link_id, slot, name, updated_at", "updated_at"),
    read("committee_approvals", "id, link_id, version, name, email, approved_at", "approved_at"),
  ]);
  for (const result of [versions, pins, votes, approvals]) throwIf(result.error, DESIGN_NOT_FOUND);
  return {
    allVersions: z.array(versionRow).parse(versions.data ?? []),
    allPins: z.array(pinRow).parse(pins.data ?? []),
    allVotes: z.array(voteRow).parse(votes.data ?? []),
    allApprovals: z.array(approvalRow).parse(approvals.data ?? []),
  };
}

/** The version this design already has locked, or null. */
async function lockOf(client: SupabaseClient, brandId: string, projectId: string): Promise<CommitteeLock | null> {
  const locked = await client
    .from("committee_locks")
    .select("version, locked_at, approval_id")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .maybeSingle();
  throwIf(locked.error, DESIGN_NOT_FOUND);
  if (!locked.data) return null;
  const row = lockRow.parse(locked.data);
  return { version: row.version, lockedAt: row.locked_at, approvalId: row.approval_id };
}

/** A design's committee links, newest first, with what each one collected. Read as the member. */
export async function listCommittee(client: SupabaseClient, brandId: string, projectId: string): Promise<CommitteeOfDesign> {
  const links = await client
    .from("committee_links")
    .select("id, created_at, expires_at, revoked_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(LINKS_LISTED);
  throwIf(links.error, DESIGN_NOT_FOUND);
  const parsed = z.array(linkRow).parse(links.data ?? []);
  const lock = await lockOf(client, brandId, projectId);
  if (parsed.length === 0) return { links: [], lock };
  const { allVersions, allPins, allVotes, allApprovals } = await collectedFor(client, brandId, parsed.map((link) => link.id));

  return {
    lock,
    links: parsed.map((link) => ({
      id: link.id,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
      slots: allVersions.filter((row) => row.link_id === link.id).map((row) => ({ slot: row.slot, version: row.version })),
      pins: allPins
        .filter((row) => row.link_id === link.id)
        .map((row) => ({ id: row.id, version: row.version, name: row.name, panelId: row.panel_id, xMm: row.x_mm, yMm: row.y_mm, body: row.body, createdAt: row.created_at })),
      votes: allVotes.filter((row) => row.link_id === link.id).map((row) => ({ slot: row.slot, name: row.name, updatedAt: row.updated_at })),
      approvals: allApprovals
        .filter((row) => row.link_id === link.id)
        .map((row) => ({ id: row.id, version: row.version, name: row.name, email: row.email, approvedAt: row.approved_at })),
    })),
  };
}
