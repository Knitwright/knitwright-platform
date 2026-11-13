import { acceptAsset, garmentSource, inputsOf, isGarmentKind, isGeneratedKind, type BoardKind, type BoardView, type Graph, type LaunchAsset } from "@/lib/launch";
import { artworkVerdict } from "./artwork";
import { boardAssets, boardFormat, boardGeneration, chargeUnits, estimateFlow, type FlowCostSource, type FlowEstimate } from "./cost";
import { dependentsOf, type ScopeInput } from "./topology";
import { FLOW_GAP_RULE, type FlowBoardState, type FlowFormat, type FlowRunState, type Generation } from "./types";

/**
 * Running a flow (spec F-L4: Regenerate, Run all downstream, per-board status, refunds on failure).
 *
 * Three promises are kept here and nowhere else:
 *
 *   1. **The order.** A board runs after the boards that feed it, so "image 1" is the picture the
 *      prompt means. The order is `topology.ts`'s; this file walks it.
 *   2. **The money.** The estimate is made before the first board runs and handed back with the
 *      report, every paid board is charged through the meter, and **a board that fails gives its
 *      credits back before the next board starts**. A board that is skipped is never charged at all.
 *   3. **The garment.** Every board's run carries the Design board behind it, found by walking the
 *      connectors backwards, and every output is recorded through `acceptAsset` and the whole-branch
 *      check of `artwork.ts`. A chain cannot launder a generated picture into artwork.
 *
 * No paid call is made here. A capability is an interface with a deterministic stub (`stub.ts`); the
 * real adapters are L2 to L5's, through the files-service contract or the lifestyle adapters. This
 * file only decides what to ask for, in what order, and what to do with the answer.
 */

/** What the board that feeds this one has to offer. A Design board offers the garment, not a file. */
export interface FlowInputRef {
  readonly boardId: string;
  readonly inputIndex: number;
  readonly kind: BoardKind;
  /** The file the input board holds, or null for a Design board, whose output is the live render. */
  readonly fileId: string | null;
  readonly generated: boolean;
}

export interface FlowRunRequest {
  readonly boardId: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly generation: Generation;
  /** The board's own prompt, scene, aspect and seconds, exactly as it was saved. */
  readonly settings: Readonly<Record<string, unknown>>;
  /** The Design board every picture on this branch starts from, and the version it is at. */
  readonly garment: Readonly<{ boardId: string; designProjectId: string | null; version: number | null }>;
  readonly inputs: readonly FlowInputRef[];
  readonly format: FlowFormat;
}

export type FlowOutcome =
  | Readonly<{ ok: true; asset: LaunchAsset }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

/** What makes a board's picture. One interface for every board kind; the stub answers in tests. */
export interface FlowCapability {
  run(request: FlowRunRequest): Promise<FlowOutcome>;
}

export interface ChargeInput {
  readonly boardId: string;
  /** The figure the person was shown for this board. The meter may never take more than this. */
  readonly credits: number;
  /** How many of its output the board makes, so the ledger charges what the estimate quoted. */
  readonly units: number;
  readonly request: FlowRunRequest;
}

export type Charge =
  /** Taken, or not taken because nothing is being charged yet (`CREDITS_ENFORCED` off). */
  | Readonly<{ ok: true; charged: boolean; credits: number; entryId: string | null }>
  /** Refused: the balance is short, or the price could not be read. Nothing was spent. */
  | Readonly<{ ok: false; reason: string }>;

/**
 * Money. `charge` is asked before a paid board runs and `refund` after one fails, so a failure never
 * leaves a brand short. With `CREDITS_ENFORCED` off nothing is charged and `charged` is false, which
 * is why the report counts what was charged rather than what was estimated.
 */
export interface FlowMeter {
  charge(input: ChargeInput): Promise<Charge>;
  refund(input: Readonly<{ boardId: string; entryId: string | null; credits: number }>): Promise<number>;
}

/** Where a finished picture and a status are written down. L1's `recordOutput` behind an interface. */
export interface FlowRecorder {
  record(input: Readonly<{ boardId: string; kind: BoardKind; asset: LaunchAsset | null; status: "ready" | "failed" | "running"; credits: number | null }>): Promise<void>;
}

export interface FlowRunLine {
  readonly boardId: string;
  readonly name: string;
  readonly kind: BoardKind;
  readonly state: FlowBoardState;
  readonly format: FlowFormat;
  readonly assets: number;
  /** Credits this board actually spent, after any refund. Never the estimate. */
  readonly credits: number;
  readonly refunded: number;
  readonly fileId: string | null;
  /** The credit ledger line this board's charge made, so a run row can name the money it moved. */
  readonly entryId: string | null;
  /** Why it did not finish, or null. Always a sentence a person can act on. */
  readonly reason: string | null;
  readonly ruleId: string;
}

export interface FlowRunReport {
  readonly state: FlowRunState;
  /** The estimate as it was shown before the run, so the summary can say what changed. */
  readonly estimate: FlowEstimate;
  readonly lines: readonly FlowRunLine[];
  readonly spent: number;
  readonly refunded: number;
  readonly assets: number;
}

export interface RunDeps {
  readonly capability: FlowCapability;
  readonly meter: FlowMeter;
  readonly recorder: FlowRecorder;
  /** Called as each board starts and finishes, so the canvas shows progress per board. */
  readonly onProgress?: (line: FlowRunLine) => void;
}

const line = (board: BoardView, state: FlowBoardState, over: Partial<FlowRunLine> = {}): FlowRunLine => ({
  boardId: board.id,
  name: board.name,
  kind: board.kind,
  state,
  format: boardFormat(board),
  assets: boardAssets(board),
  credits: 0,
  refunded: 0,
  fileId: null,
  entryId: null,
  reason: null,
  ruleId: board.ruleId || FLOW_GAP_RULE,
  ...over,
});

/**
 * A capability is somebody else's code reaching a model over a network, so it may reject rather
 * than answer. A rejection that got out of here would leave a board charged, with no row written
 * and no refund made, which is the one thing this file exists to prevent. So every call to another
 * workstream's code is a value, never an exception.
 */
async function attempt(deps: RunDeps, request: FlowRunRequest): Promise<FlowOutcome> {
  try {
    return await deps.capability.run(request);
  } catch {
    return { ok: false, reason: "That board could not be run just now. Nothing was kept, and the credits were given back.", ruleId: FLOW_GAP_RULE };
  }
}

/** The same for the recorder: a write that fails is a board that did not finish, not a thrown run. */
async function write(deps: RunDeps, input: Parameters<FlowRecorder["record"]>[0]): Promise<boolean> {
  try {
    await deps.recorder.record(input);
    return true;
  } catch {
    return false;
  }
}

/** What each board that feeds this one has, taking this run's own outputs into account. */
function inputsFor(graph: Graph, boardId: string, produced: ReadonlyMap<string, string>): readonly FlowInputRef[] {
  return inputsOf(graph, boardId).flatMap((edge): readonly FlowInputRef[] => {
    const board = graph.boards.find((one) => one.id === edge.fromBoardId);
    if (!board) return [];
    return [
      {
        boardId: board.id,
        inputIndex: edge.inputIndex,
        kind: board.kind,
        fileId: produced.get(board.id) ?? board.outputFileId,
        generated: isGeneratedKind(board.kind),
      },
    ];
  });
}

const nameOf = (graph: Graph, boardId: string): string => graph.boards.find((one) => one.id === boardId)?.name || boardId;

/** Why this board cannot be run now, or null: a missing input is as real a refusal as a missing design. */
function refusalFor(graph: Graph, inputs: readonly FlowInputRef[]): string | null {
  const empty = inputs.filter((input) => !isGarmentKind(input.kind) && input.fileId === null);
  if (empty.length === 0) return null;
  const names = empty.map((input) => nameOf(graph, input.boardId)).join(", ");
  return `The board that feeds this one has not been run yet (${names}). Run all, or run that board first.`;
}

const requestFor = (graph: Graph, board: BoardView, inputs: readonly FlowInputRef[]): FlowRunRequest | null => {
  const source = garmentSource(graph, board.id);
  if (!source.locked) return null;
  return {
    boardId: board.id,
    kind: board.kind,
    name: board.name,
    generation: boardGeneration(board),
    settings: board.settings,
    garment: { boardId: source.boardId, designProjectId: source.designProjectId, version: source.version },
    inputs,
    format: boardFormat(board),
  };
};

const stateOf = (lines: readonly FlowRunLine[]): FlowRunState => {
  if (lines.length === 0) return "done";
  const ready = lines.filter((one) => one.state === "ready").length;
  if (ready === lines.length) return "done";
  return ready === 0 ? "failed" : "part_done";
};

/**
 * Runs the boards one press asked for, in order. Returns what every board did, what was spent after
 * refunds and how many assets came out. Nothing here throws on a board's failure: a failure is a
 * line of the report, because the run carries on with the boards a failure does not reach.
 */
export async function runFlow(deps: RunDeps, graph: Graph, input: ScopeInput, source: FlowCostSource): Promise<FlowRunReport> {
  const estimate = estimateFlow(graph, input, source);
  const produced = new Map<string, string>();
  const lost = new Set<string>();
  const lines: FlowRunLine[] = [];

  for (const planned of estimate.lines) {
    const board = graph.boards.find((one) => one.id === planned.boardId);
    if (!board) continue;
    const done = await runBoard(deps, { graph, board, planned, produced, lost });
    lines.push(done);
    deps.onProgress?.(done);
    if (done.state === "ready" && done.fileId !== null) produced.set(board.id, done.fileId);
    if (done.state !== "ready") for (const id of dependentsOf(graph, board.id)) lost.add(id);
  }

  return {
    state: stateOf(lines),
    estimate,
    lines,
    spent: lines.reduce((total, one) => total + one.credits, 0),
    refunded: lines.reduce((total, one) => total + one.refunded, 0),
    assets: lines.filter((one) => one.state === "ready").reduce((total, one) => total + one.assets, 0),
  };
}

interface BoardRun {
  readonly graph: Graph;
  readonly board: BoardView;
  readonly planned: FlowEstimate["lines"][number];
  readonly produced: ReadonlyMap<string, string>;
  readonly lost: ReadonlySet<string>;
}

/** One board: skipped, charged and run, or failed and given back. */
async function runBoard(deps: RunDeps, context: BoardRun): Promise<FlowRunLine> {
  const { graph, board, planned } = context;
  if (planned.blocked !== null) return line(board, "skipped", { reason: planned.blocked });
  if (context.lost.has(board.id)) {
    return line(board, "skipped", { reason: "The board that feeds this one did not finish, so there was nothing to start from. Nothing was charged." });
  }
  const inputs = inputsFor(graph, board.id, context.produced);
  const refusal = refusalFor(graph, inputs);
  if (refusal !== null) return line(board, "skipped", { reason: refusal });
  const request = requestFor(graph, board, inputs);
  if (request === null) {
    return line(board, "skipped", { reason: "Connect a Design board first: every picture starts from the design the platform drew." });
  }

  const charge = planned.credits > 0 ? await deps.meter.charge({ boardId: board.id, credits: planned.credits, units: chargeUnits(board), request }) : null;
  if (charge !== null && !charge.ok) return line(board, "failed", { reason: `${charge.reason} Nothing was charged for this board.` });
  const taken = charge !== null && charge.ok ? charge : null;
  // The last gate on money: the figure the person was shown is the most that may be taken. A meter
  // that took more gives it straight back and the board fails, rather than the run carrying on with
  // a charge nobody agreed to (decision 0096, item 4).
  if (taken !== null && taken.credits > planned.credits) {
    return await giveBack(deps, context, taken, `This board turned out to cost ${taken.credits} credits rather than the ${planned.credits} you were shown, so it was not run and the credits were given back.`, FLOW_GAP_RULE);
  }
  if (!(await write(deps, { boardId: board.id, kind: board.kind, asset: null, status: "running", credits: null }))) {
    return await giveBack(deps, context, taken, "That board's status could not be saved, so it was not run.", FLOW_GAP_RULE);
  }

  const outcome = await attempt(deps, request);
  if (!outcome.ok) return await giveBack(deps, context, taken, outcome.reason, outcome.ruleId);
  return acceptOutput(deps, context, outcome.asset, taken);
}

type Taken = Readonly<{ credits: number; entryId: string | null }> | null;

/** A board that did not finish: the credits go back before the next board starts, and the line says so. */
async function giveBack(deps: RunDeps, context: BoardRun, taken: Taken, reason: string, ruleId: string): Promise<FlowRunLine> {
  const { board } = context;
  const refunded = taken === null ? 0 : await deps.meter.refund({ boardId: board.id, entryId: taken.entryId, credits: taken.credits }).catch(() => 0);
  await write(deps, { boardId: board.id, kind: board.kind, asset: null, status: "failed", credits: 0 });
  return line(board, "failed", {
    reason,
    ruleId,
    credits: Math.max(0, (taken?.credits ?? 0) - refunded),
    refunded,
    entryId: taken?.entryId ?? null,
  });
}

/**
 * Records a finished picture, or refuses it and gives the credits back.
 *
 * Two refusals, both spec decision 13: `acceptAsset` is L1's, on the board's own kind; the branch
 * check is this directory's, on everything behind it. A picture that cannot be recorded as what it
 * claims to be is a failure of the board, not a quiet downgrade -- a print file that silently became
 * an asset would be a surprise in a factory file later.
 */
async function acceptOutput(deps: RunDeps, context: BoardRun, asset: LaunchAsset, taken: Taken): Promise<FlowRunLine> {
  const { graph, board } = context;
  const verdict = acceptAsset(board.kind, asset);
  if (!verdict.accepted) return await giveBack(deps, context, taken, verdict.reason, verdict.ruleId);
  const branch = artworkVerdict(graph, board.id, verdict.role);
  if (!branch.allowed) return await giveBack(deps, context, taken, branch.reason, branch.ruleId);
  if (!(await write(deps, { boardId: board.id, kind: board.kind, asset, status: "ready", credits: taken?.credits ?? 0 }))) {
    return await giveBack(deps, context, taken, "That board's picture could not be saved, so it was not kept.", FLOW_GAP_RULE);
  }
  return line(board, "ready", { credits: taken?.credits ?? 0, fileId: asset.file.fileId, entryId: taken?.entryId ?? null });
}
