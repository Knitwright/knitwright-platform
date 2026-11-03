import { z } from "zod";
import { confirmField } from "@/lib/deletion/schemas";
import { ARTBOARD_UNITS, MAX_ARTBOARD_PX, MIN_ARTBOARD_PX } from "./artboard";
import { BOARD_KINDS } from "./boards";

/**
 * What the launch screens may send (plan v5 L1, decision 0091). The brand and the person are never
 * in a body: they come from the session.
 *
 * Nothing here can ask for a generated picture to become artwork. `offerAsset` is the only way an
 * output is recorded, and its role comes from `lib/launch/assets.ts`, where a generated asset has
 * no role but "scene" (spec decision 13). This file carries zod, so it is deliberately left out of
 * `index.ts`: a client component that imported it would ship zod to the browser.
 */

const name = z.string().trim().min(1).max(80);
const canvas = z.number().int().min(-1_000_000).max(1_000_000);
const side = z.number().int().min(MIN_ARTBOARD_PX).max(MAX_ARTBOARD_PX);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour such as #0B1F4B.");

export const projectColour = z.object({ hex, name: z.string().trim().min(1).max(60) });

export const createLaunchProjectBody = z.object({
  name,
  units: z.enum(ARTBOARD_UNITS).default("px"),
  /** The design the project is launching, when one is chosen on the way in. */
  designProjectId: z.uuid().nullable().default(null),
});
export type CreateLaunchProjectBody = z.output<typeof createLaunchProjectBody>;

export const saveLaunchProjectBody = z.object({
  launchProjectId: z.uuid(),
  name: name.nullable().default(null),
  units: z.enum(ARTBOARD_UNITS).nullable().default(null),
  colours: z.array(projectColour).max(48).nullable().default(null),
});
export type SaveLaunchProjectBody = z.output<typeof saveLaunchProjectBody>;

/**
 * Removing a launch project. Its boards, its connectors, its saved versions, its shoots, its flow
 * runs and anything waiting for the Store to collect all go with it, so the word is typed first,
 * exactly as deleting a design asks for it (`lib/deletion/schemas.ts`).
 */
export const removeLaunchProjectBody = z.object({ launchProjectId: z.uuid(), confirm: confirmField });

export const saveBoardBody = z.object({
  launchProjectId: z.uuid(),
  /** Null adds a board; an id moves, resizes or re-settings one. A kind never changes. */
  boardId: z.uuid().nullable().default(null),
  kind: z.enum(BOARD_KINDS),
  name: z.string().trim().max(80).default(""),
  x: canvas.default(0),
  y: canvas.default(0),
  width: side.default(1080),
  height: side.default(1080),
  /** The board's own prompt, model, aspect and style. The shell never reads inside it. */
  settings: z.record(z.string().min(1).max(64), z.unknown()).default({}),
  inputVersion: z.number().int().min(1).nullable().default(null),
});
export type SaveBoardBody = z.output<typeof saveBoardBody>;

export const removeBoardBody = z.object({ launchProjectId: z.uuid(), boardId: z.uuid() });

export const connectBoardsBody = z.object({
  launchProjectId: z.uuid(),
  fromBoardId: z.uuid(),
  toBoardId: z.uuid(),
  inputIndex: z.number().int().min(1).max(16).default(1),
});
export type ConnectBoardsBody = z.output<typeof connectBoardsBody>;

export const disconnectBoardsBody = z.object({ launchProjectId: z.uuid(), edgeId: z.uuid() });

export const saveVersionBody = z.object({ launchProjectId: z.uuid() });

/**
 * What a panel hands the shell when a run finishes (`offerAsset` of the contract).
 *
 * **There is no `provenance` here, and there must never be one again** (security review v5 H1,
 * decision 0116). It was a `z.enum(["deterministic", "golden_sample", "generated"])` in this body,
 * which made the one fact the garment lock turns on a string the client sends: a member with
 * `manageKit` could offer a file a model had made as a `print_file` with
 * `provenance: "deterministic"`, and all six enforcement points agreed, because every one tested
 * the board or the graph and none tested the file.
 *
 * What made a file is now the file's own (`public.files.provenance`), read by `recordOutput` from
 * the row. The role stays, because what a panel *wants* a picture used as is a legitimate thing for
 * it to ask; the server refuses the ask when the file's real provenance will not carry it.
 * `lib/launch/garment-lock-provenance.test.ts` fails if a provenance reappears in any request
 * schema.
 */
export const recordOutputBody = z.object({
  launchProjectId: z.uuid(),
  boardId: z.uuid(),
  asset: z
    .object({
      role: z.enum(["scene", "panel_layer", "print_file"]),
      fileId: z.uuid(),
      showsPerson: z.boolean().default(false),
    })
    .nullable(),
  status: z.enum(["queued", "running", "ready", "failed"]),
  /** Credits the run actually spent, from the meter. Null when nothing was charged. */
  credits: z.number().int().min(0).max(1_000_000).nullable().default(null),
});
export type RecordOutputBody = z.output<typeof recordOutputBody>;

/** The shape a saved version holds, so a version can be read back as a canvas and not as anything else. */
export const snapshotSchema = z.object({
  kind: z.literal("launch-canvas"),
  snapshotVersion: z.literal(1),
  savedAt: z.string(),
  units: z.enum(ARTBOARD_UNITS),
  colours: z.array(projectColour),
  boards: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(BOARD_KINDS),
      name: z.string(),
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int(),
      height: z.number().int(),
      settings: z.record(z.string(), z.unknown()),
      inputVersion: z.number().int().nullable(),
      status: z.string(),
    }),
  ),
  edges: z.array(z.object({ fromBoardId: z.uuid(), toBoardId: z.uuid(), inputIndex: z.number().int() })),
});
export type LaunchSnapshot = z.output<typeof snapshotSchema>;
