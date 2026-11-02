import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { refusal } from "@/lib/make/service";
import { connectBoards, saveBoard, type Who } from "@/lib/launch/service";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { BOARD_KINDS, type ArtboardPreset } from "@/lib/launch";
import { planTemplate, type FlowPlan } from "./apply";
import type { ListingPayload } from "./listing";
import type { FlowRunLine, FlowRunReport } from "./run";
import { flowTemplate } from "./templates";
import { FLOW_BOARD_STATES, FLOW_FORMATS, FLOW_GAP_RULE, FLOW_RUN_STATES, FLOW_SCOPES, type FlowBoardState, type FlowFormat, type FlowRunState, type FlowScope } from "./types";

/**
 * The flow tables (migration 20261201030000), and the one write that is not one of them: opening a
 * flow template, which goes through L1's own `save_launch_board` and `connect_launch_boards`.
 *
 * That is the point of doing it here rather than through the panel contract. A pack adds fourteen
 * boards and thirteen connectors, and every one of them goes through the checks L1 built -- the
 * board table, the input numbering, the loop check and the role check -- so **a pack cannot wire a
 * canvas a person could not have wired by hand**. It also means a pack appears in one save instead
 * of fourteen.
 *
 * Reads go through the client the caller passes, which in a page is the member's own, so the
 * database's own rules decide what is seen.
 */

const NOT_FOUND = "That launch project does not exist.";

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

export interface AppliedTemplate {
  readonly plan: FlowPlan;
  /** The board id each step of the pack became, by the pack's own step key. */
  readonly boardIds: Readonly<Record<string, string>>;
}

export interface ApplyTemplateInput {
  readonly launchProjectId: string;
  readonly template: string;
  readonly designProjectId: string | null;
  readonly designVersion: number | null;
  readonly presets: readonly ArtboardPreset[];
  readonly origin?: Readonly<{ x: number; y: number }>;
}

/**
 * Opens a flow template on a canvas: every board, then every connector, in the pack's own order.
 * The boards go in first because a connector names two of them.
 */
export async function applyFlowTemplate(admin: SupabaseClient, who: Who, input: ApplyTemplateInput): Promise<AppliedTemplate> {
  const spec = flowTemplate(input.template);
  if (!spec) throw new AppError("not_found", "That flow template does not exist.");
  const plan = planTemplate(spec, {
    designProjectId: input.designProjectId,
    designVersion: input.designVersion,
    presets: input.presets,
    ...(input.origin ? { origin: input.origin } : {}),
  });
  const boardIds: Record<string, string> = {};
  for (const board of plan.boards) {
    boardIds[board.key] = await saveBoard(admin, who, {
      launchProjectId: input.launchProjectId,
      boardId: null,
      kind: board.kind,
      name: board.name,
      x: board.at.x,
      y: board.at.y,
      width: board.size.width,
      height: board.size.height,
      settings: board.settings,
      inputVersion: board.inputVersion,
    });
  }
  for (const link of plan.links) {
    await connectBoards(admin, who, {
      launchProjectId: input.launchProjectId,
      fromBoardId: boardIds[link.from] as string,
      toBoardId: boardIds[link.to] as string,
      inputIndex: link.inputIndex,
    });
  }
  return { plan, boardIds };
}

export interface StartRunInput {
  readonly launchProjectId: string;
  readonly scope: FlowScope;
  readonly fromBoardId: string | null;
  readonly estimateCredits: number;
  readonly template: string | null;
}

/** Starts a run and writes down the estimate that was shown before it. */
export async function startFlowRun(admin: SupabaseClient, who: Who, input: StartRunInput): Promise<string> {
  const { data, error } = await admin.rpc("start_flow_run", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_launch_project_id: input.launchProjectId,
    p_scope: input.scope,
    p_from_board_id: input.fromBoardId,
    p_estimate_credits: input.estimateCredits,
    p_template_slug: input.template,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
}

/** Records what one board of a run did, as it starts and again as it finishes. */
export async function setFlowRunBoard(
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{
    runId: string;
    boardId: string;
    kind: FlowRunLine["kind"];
    position: number;
    status: FlowBoardState;
    credits: number;
    refunded: number;
    spendEntryId: string | null;
    assets: number;
    format: FlowFormat;
    outputFileId: string | null;
    reason: string | null;
  }>,
): Promise<void> {
  const { error } = await admin.rpc("set_flow_run_board", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_run_id: input.runId,
    p_board_id: input.boardId,
    p_position: input.position,
    p_status: input.status,
    p_credits: input.credits,
    p_refunded: input.refunded,
    p_spend_entry_id: input.spendEntryId,
    p_assets: input.assets,
    p_format: input.format,
    p_output_file_id: input.outputFileId,
    p_reason: input.reason,
    p_kind: input.kind,
  });
  if (error) throw refusal(error, "That board does not exist.");
}

/** Closes a run: its status, what it spent after refunds and how many assets came out. */
export async function finishFlowRun(
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ runId: string; status: FlowRunState; spent: number; refunded: number; assets: number }>,
): Promise<void> {
  const { error } = await admin.rpc("finish_flow_run", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_run_id: input.runId,
    p_status: input.status,
    p_spent: input.spent,
    p_refunded: input.refunded,
    p_assets: input.assets,
  });
  if (error) throw refusal(error, "That flow run does not exist.");
}

const spendAnswer = z.union([
  z.object({ ok: z.literal(true), charged: z.boolean(), price: z.number(), balance: z.number(), entry_id: z.string().nullable() }),
  z.object({ ok: z.literal(false), reason: z.literal("insufficient"), price: z.number(), balance: z.number() }),
]);

export type SpendOutcome =
  | Readonly<{ ok: true; charged: boolean; price: number; balance: number; entryId: string | null }>
  | Readonly<{ ok: false; price: number; balance: number }>;

/**
 * Charges for ONE board's output, once per design version and board (migration 20261201030000).
 *
 * The credits code's own `credit_spend` charges once per output kind and design version, which for
 * a launch pack would mean one charge for fourteen boards. `credit_spend_output` keeps that
 * idempotency but adds the board to the key, so a pack of three paid boards is three charges and a
 * failure gives one of them back. The ledger line still names the plain design version, so the
 * existing "credits come back when the design is ordered" refund still sweeps them up.
 */
export async function spendFlowOutput(
  admin: SupabaseClient,
  input: Readonly<{ brandId: string; userId: string; designVersionHash: string; outputKey: string; units?: number; usageEventId?: string | null }>,
): Promise<SpendOutcome> {
  const { data, error } = await admin.rpc("credit_spend_output", {
    p_brand_id: input.brandId,
    p_user_id: input.userId,
    p_kind: "marketing_media",
    p_version_hash: input.designVersionHash,
    p_output_key: input.outputKey,
    p_usage_event_id: input.usageEventId ?? null,
    p_units: input.units ?? 1,
  });
  if (error) throw refusal(error, "The credits could not be charged.");
  const answer = spendAnswer.parse(data);
  return answer.ok
    ? { ok: true, charged: answer.charged, price: answer.price, balance: answer.balance, entryId: answer.entry_id }
    : { ok: false, price: answer.price, balance: answer.balance };
}

const refundAnswer = z.object({ refunded: z.number(), balance: z.number() });

/**
 * Gives back one spend, once (migration 20261201030000). The credits code's own
 * `refundForOrder` gives back every spend on a design version, which is the wrong shape for one
 * board of fourteen failing.
 */
export async function refundFlowSpend(admin: SupabaseClient, brandId: string, entryId: string, note: string): Promise<number> {
  const { data, error } = await admin.rpc("credit_refund_spend", { p_brand_id: brandId, p_entry_id: entryId, p_note: note });
  if (error) throw refusal(error, "The credits could not be given back.");
  return refundAnswer.parse(data).refunded;
}

/** Writes a listing hand-off for the Store to collect. It publishes nothing. */
export async function publishFlowListing(admin: SupabaseClient, who: Who, launchProjectId: string, payload: ListingPayload): Promise<string> {
  const { data, error } = await admin.rpc("publish_flow_listing", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_launch_project_id: launchProjectId,
    p_payload: payload,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
}

const runBoardRow = z.object({
  board_id: z.uuid(),
  kind: z.enum(BOARD_KINDS),
  position: z.number().int(),
  status: z.enum(FLOW_BOARD_STATES),
  credits: z.number().int(),
  refunded_credits: z.number().int(),
  assets: z.number().int(),
  format: z.enum(FLOW_FORMATS),
  output_file_id: z.uuid().nullable(),
  spend_entry_id: z.uuid().nullable(),
  reason: z.string().nullable(),
  rule_id: z.string(),
});

const runRow = z.object({
  id: z.uuid(),
  scope: z.enum(FLOW_SCOPES),
  from_board_id: z.uuid().nullable(),
  status: z.enum(FLOW_RUN_STATES),
  estimate_credits: z.number().int(),
  spent_credits: z.number().int(),
  refunded_credits: z.number().int(),
  assets: z.number().int(),
  template_slug: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
  flow_run_boards: z.array(runBoardRow),
});

export interface SavedRun {
  readonly id: string;
  readonly scope: FlowScope;
  readonly fromBoardId: string | null;
  readonly template: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly estimateCredits: number;
  readonly report: Readonly<{ state: FlowRunState; lines: readonly FlowRunLine[]; spent: number; refunded: number; assets: number }>;
}

const RUN_SELECT = [
  "id, scope, from_board_id, status, estimate_credits, spent_credits, refunded_credits, assets, template_slug, created_at, finished_at",
  "flow_run_boards(board_id, kind, position, status, credits, refunded_credits, assets, format, output_file_id, spend_entry_id, reason, rule_id)",
].join(", ");

/**
 * The most recent run of a canvas, with a line per board in the order it ran. The run summary is
 * read from here, so closing the page and coming back shows the same panel.
 */
export async function latestFlowRun(
  client: SupabaseClient,
  brandId: string,
  launchProjectId: string,
  names: ReadonlyMap<string, Readonly<{ name: string; kind: FlowRunLine["kind"] }>>,
): Promise<SavedRun | null> {
  const { data, error } = await client
    .from("flow_runs")
    .select(RUN_SELECT)
    .eq("brand_id", brandId)
    .eq("launch_project_id", launchProjectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw unreadable(error);
  if (data === null) return null;
  const row = runRow.safeParse(data);
  if (!row.success) throw unreadable(row.error);
  const lines: readonly FlowRunLine[] = [...row.data.flow_run_boards]
    .sort((a, b) => a.position - b.position)
    .map((one) => ({
      boardId: one.board_id,
      name: names.get(one.board_id)?.name ?? "",
      // The kind the board had when it ran, from the run's own row: a board that has since been
      // removed would otherwise read back on the summary as some other kind of board.
      kind: one.kind,
      state: one.status,
      format: one.format,
      assets: one.assets,
      credits: one.credits,
      refunded: one.refunded_credits,
      fileId: one.output_file_id,
      entryId: one.spend_entry_id,
      reason: one.reason,
      ruleId: one.rule_id || FLOW_GAP_RULE,
    }));
  return {
    id: row.data.id,
    scope: row.data.scope,
    fromBoardId: row.data.from_board_id,
    template: row.data.template_slug,
    createdAt: row.data.created_at,
    finishedAt: row.data.finished_at,
    estimateCredits: row.data.estimate_credits,
    report: {
      state: row.data.status,
      lines,
      spent: row.data.spent_credits,
      refunded: row.data.refunded_credits,
      assets: row.data.assets,
    },
  };
}

/** Builds the whole-report shape the summary wants, with the estimate it was run against. */
export const reportOf = (run: SavedRun, estimate: FlowRunReport["estimate"]): FlowRunReport => ({
  state: run.report.state,
  estimate,
  lines: run.report.lines,
  spent: run.report.spent,
  refunded: run.report.refunded,
  assets: run.report.assets,
});
