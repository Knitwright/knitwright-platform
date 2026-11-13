import { inputsOf, isGeneratedKind, type Graph } from "@/lib/launch";
import { carriesGenerated } from "./artwork";
import { boardFormat } from "./cost";
import { FLOW_GAP_RULE, type FlowFormat } from "./types";

/**
 * "Publish to store" (spec F-L4) -- which does not publish anything.
 *
 * Owner decision 1 keeps the Store out of this platform. There is no cart, no checkout, no price,
 * no payment and no storefront here, and there is no column in this workstream's tables that could
 * hold one. What the button does is write a **listing payload**: a plain, versioned record of which
 * finished pictures and clips of this run belong to a listing. The listing editor's mockup library reads
 * it as a picture source (`lib/storefront/media.ts`, decision 0154); the outside Store contract that
 * once collected it is retired (decision 0157).
 *
 * Two rules of the spec travel inside the payload rather than being left for the Store to remember:
 *
 *   * **everything a model made carries its label**, so a listing cannot show an AI scene as a
 *     photograph;
 *   * **every AI scene names the true-colour picture that goes beside it** (F-L1's own rule), found
 *     by walking back up the connectors to the nearest board the platform drew itself.
 *
 * `listing.test.ts` holds the payload to having no field about money, stock or a storefront.
 */

export const LISTING_KIND = "launch-listing";
export const LISTING_PAYLOAD_VERSION = 1;

export type MediaRole = "image" | "video";

export interface ListingMedia {
  readonly boardId: string;
  readonly name: string;
  readonly fileId: string;
  readonly format: FlowFormat;
  readonly role: MediaRole;
  /** "AI-generated" where a model made or touched it, or null. */
  readonly label: string | null;
  /**
   * The picture the platform drew that a storefront shows beside an AI scene (spec F-L1: "the
   * storefront shows a true-colour sample photo beside AI images").
   *
   * Null when this item is such a picture already, and also when the nearest board the platform drew
   * is the Design board itself, which holds a live render and no file. The Store draws that render
   * from the design version named above rather than being handed a file that does not exist.
   */
  readonly trueColourFileId: string | null;
  readonly sort: number;
}

export interface ListingPayload {
  readonly kind: typeof LISTING_KIND;
  readonly payloadVersion: typeof LISTING_PAYLOAD_VERSION;
  readonly launchProjectId: string;
  readonly title: string;
  /** The design the pack was made from, so the Store reads the sizes and the chart from it. */
  readonly designProjectId: string | null;
  readonly designVersion: number | null;
  readonly media: readonly ListingMedia[];
  /** Says plainly that nothing has been published and who collects this. */
  readonly note: string;
  readonly ruleId: string;
}

export const LISTING_NOTE =
  "A hand-off, not a publication. Nothing has been published, priced or put on sale: this record names the pictures a listing may use, and the Store collects it.";

/** The nearest board the platform drew itself, walking back up the connectors. Null when there is none. */
export function trueColourSource(graph: Graph, boardId: string): string | null {
  const seen = new Set<string>();
  const queue = [boardId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const board = graph.boards.find((one) => one.id === id);
    if (!board) continue;
    if (id !== boardId && !isGeneratedKind(board.kind) && board.outputFileId !== null) return board.outputFileId;
    for (const edge of inputsOf(graph, id)) queue.push(edge.fromBoardId);
  }
  return null;
}

export interface ListingInput {
  readonly launchProjectId: string;
  readonly title: string;
  readonly designProjectId: string | null;
  readonly designVersion: number | null;
  /** The boards to offer, by id. Empty means every board of the canvas that has a finished output. */
  readonly boardIds?: readonly string[];
  /**
   * The output files of this canvas that a model made, read from `public.files.provenance`
   * (security review v5 H1, decision 0116).
   *
   * The label used to be worked out from the graph alone, and the graph is a sound answer again now
   * that `recordOutput` reads a file's provenance from its own row -- a generated file can no
   * longer be recorded on a board the platform draws. This is the belt beside that brace, and it is
   * the answer the review asked for: label from the file. A caller that cannot read the rows, such
   * as the panel drawing a preview in the browser, leaves it out and gets the topology answer,
   * which can only ever be as strict or stricter than it was.
   */
  readonly generatedFileIds?: readonly string[];
}

const roleOf = (format: FlowFormat): MediaRole => (format === "mp4" ? "video" : "image");

/**
 * The payload for a run's finished outputs. A board with nothing on it is left out rather than sent
 * as an empty item: a listing with a hole in it is worse than a listing with fewer pictures.
 */
export function listingPayload(graph: Graph, input: ListingInput): ListingPayload {
  const wanted = input.boardIds === undefined ? null : new Set(input.boardIds);
  const fromAModel = new Set(input.generatedFileIds ?? []);
  const media = graph.boards
    .filter((board) => board.status === "ready" && board.outputFileId !== null && (wanted === null || wanted.has(board.id)))
    .map((board, at): ListingMedia => {
      // Either answer is enough to label it: what the graph says could have reached this board, and
      // what the file's own row says made it.
      const generated = carriesGenerated(graph, board.id) || fromAModel.has(board.outputFileId as string);
      const format = boardFormat(board);
      return {
        boardId: board.id,
        name: board.name,
        fileId: board.outputFileId as string,
        format,
        role: roleOf(format),
        label: generated ? "AI-generated" : null,
        trueColourFileId: generated ? trueColourSource(graph, board.id) : null,
        sort: at + 1,
      };
    });
  return {
    kind: LISTING_KIND,
    payloadVersion: LISTING_PAYLOAD_VERSION,
    launchProjectId: input.launchProjectId,
    title: input.title,
    designProjectId: input.designProjectId,
    designVersion: input.designVersion,
    media,
    note: LISTING_NOTE,
    ruleId: FLOW_GAP_RULE,
  };
}

export type ListingVerdict = Readonly<{ ready: true }> | Readonly<{ ready: false; reason: string; ruleId: string }>;

/** Whether there is anything to hand over yet, so the button can say why it is off. */
export function listingVerdict(payload: ListingPayload): ListingVerdict {
  if (payload.media.length === 0) {
    return { ready: false, reason: "Run the flow first: a listing needs at least one finished picture.", ruleId: FLOW_GAP_RULE };
  }
  if (payload.designProjectId === null) {
    return { ready: false, reason: "Put a design on the Design board first: a listing is a listing of a design.", ruleId: FLOW_GAP_RULE };
  }
  if (!payload.media.some((one) => one.role === "image")) {
    return { ready: false, reason: "A listing needs at least one picture, not only a clip.", ruleId: FLOW_GAP_RULE };
  }
  return { ready: true };
}
