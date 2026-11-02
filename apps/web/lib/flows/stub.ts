import { GENERATED_LABEL, isGeneratedKind, type LaunchAsset } from "@/lib/launch";
import { CONTENT_TYPES, FLOW_GAP_RULE } from "./types";
import type { Charge, FlowCapability, FlowMeter, FlowOutcome, FlowRecorder, FlowRunRequest } from "./run";

/**
 * The deterministic stubs. **No test and no local run ever makes a paid call** (plan v5, rules every
 * workstream follows): every capability is an interface, and this is the double behind it until L2
 * to L5 land their adapters, which reach a model only behind an env key.
 *
 * A stubbed picture is a file id worked out from what was asked for, so the same request always
 * gives the same answer and a test can say which file a board should be holding. It carries the same
 * provenance the real thing would: a board a model draws gives a `SceneAsset`, labelled
 * "AI-generated", and a board the platform draws gives a `DrawnAsset`. That matters more than it
 * looks: it means the garment-lock tests are testing the real rule and not a fixture's politeness.
 */

/** A file id that is the same for the same request and different for a different one. */
export function stubFileId(request: FlowRunRequest): string {
  const seed = `${request.boardId}|${request.garment.designProjectId ?? "none"}|${request.garment.version ?? 0}|${JSON.stringify(request.settings)}`;
  let hash = 0x811c9dc5;
  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0");
  // A uuid in the shape the database wants, built from the hash, so no two runs of one board differ.
  return `${hex}-0000-4000-8000-${hex}00000000`.slice(0, 36);
}

export const stubAsset = (request: FlowRunRequest): LaunchAsset => {
  const file = { fileId: stubFileId(request), contentType: CONTENT_TYPES[request.format] };
  return isGeneratedKind(request.kind)
    ? { role: "scene", provenance: "generated", file, label: GENERATED_LABEL, showsPerson: request.settings["showsPerson"] === true }
    : { role: "scene", provenance: "deterministic", file };
};

export interface StubOptions {
  /** Board ids whose run fails, so a test can watch a refund happen. */
  readonly failing?: readonly string[];
  /** Why they fail. Always a sentence a person could act on. */
  readonly reason?: string;
  /** An asset of this workstream's choosing, for the tests that push at the garment lock. */
  readonly asset?: (request: FlowRunRequest) => LaunchAsset;
}

/** A capability that answers at once, the same way every time, and never touches a network. */
export const stubCapability = (options: StubOptions = {}): FlowCapability => ({
  run: async (request): Promise<FlowOutcome> => {
    if (options.failing?.includes(request.boardId)) {
      return { ok: false, reason: options.reason ?? "The picture did not come back. Nothing was kept, and the credits were given back.", ruleId: FLOW_GAP_RULE };
    }
    return { ok: true, asset: (options.asset ?? stubAsset)(request) };
  },
});

export interface StubMeterOptions {
  /** The balance the meter has. A charge beyond it is refused, as the real one refuses it. */
  readonly balance?: number;
  /** False while nothing is being charged at all (`CREDITS_ENFORCED` off), which is where we are. */
  readonly enforced?: boolean;
}

export interface StubMeter extends FlowMeter {
  /** Every charge and refund, in order, so a test can read what money did. */
  readonly moves: readonly Readonly<{ kind: "charge" | "refund"; boardId: string; credits: number }>[];
  readonly balance: () => number;
}

/** A meter that keeps a balance in memory and writes nothing. */
export function stubMeter(options: StubMeterOptions = {}): StubMeter {
  const moves: { kind: "charge" | "refund"; boardId: string; credits: number }[] = [];
  const enforced = options.enforced ?? true;
  let balance = options.balance ?? 1_000;
  return {
    moves,
    balance: () => balance,
    charge: async (input): Promise<Charge> => {
      if (!enforced) return { ok: true, charged: false, credits: 0, entryId: null };
      if (balance < input.credits) {
        return { ok: false, reason: `This board costs ${input.credits} credits and the balance is ${balance}.` };
      }
      balance -= input.credits;
      moves.push({ kind: "charge", boardId: input.boardId, credits: input.credits });
      return { ok: true, charged: true, credits: input.credits, entryId: `entry-${input.boardId}` };
    },
    refund: async (input): Promise<number> => {
      if (input.credits === 0) return 0;
      balance += input.credits;
      moves.push({ kind: "refund", boardId: input.boardId, credits: input.credits });
      return input.credits;
    },
  };
}

export interface StubRecorder extends FlowRecorder {
  /** Every write, in order: a test reads it to see that a status reached the board. */
  readonly written: readonly Readonly<{ boardId: string; status: string; credits: number | null; fileId: string | null; role: string | null }>[];
}

export function stubRecorder(): StubRecorder {
  const written: { boardId: string; status: string; credits: number | null; fileId: string | null; role: string | null }[] = [];
  return {
    written,
    record: async (input): Promise<void> => {
      written.push({
        boardId: input.boardId,
        status: input.status,
        credits: input.credits,
        fileId: input.asset?.file.fileId ?? null,
        role: input.asset?.role ?? null,
      });
    },
  };
}

/** The cost figures a test runs with: one credit a generated board, as the credit prices seed. */
export const STUB_COSTS = {
  perGeneratedBoard: 1,
  perVideoSecond: null,
  note: "These are placeholder numbers, not a price. The owner has not set what credits cost or how many each brand gets.",
  ruleId: FLOW_GAP_RULE,
} as const;
