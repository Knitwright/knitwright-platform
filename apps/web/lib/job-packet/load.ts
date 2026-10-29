import { buildSheet, type SheetModel } from "@/lib/ops/factory-sheet/model";
import type { Batch } from "@/lib/ops/rows";
import type { OpsSettings } from "@/lib/ops/settings";
import { sheetInputOf, type loadBatchSources } from "@/lib/ops/sheet-data";
import type { FactoryEvent, OpenPacket } from "./service";
import { lastStep, nextStep, type FactoryStep } from "./steps";
import { isPacketToken } from "./token";

/**
 * What the factory's page is drawn from. Everything is read for the batch the token's packet names, never for
 * anything the visitor sends. The lists come from the same model as the ops factory sheet, so the page and the
 * PDF can never disagree.
 */

type Sources = Awaited<ReturnType<typeof loadBatchSources>>;

export interface PacketLoadDeps {
  readonly open: (token: string) => Promise<OpenPacket | null>;
  readonly sources: (batchId: string) => Promise<Sources>;
  readonly settings: () => Promise<OpsSettings>;
  readonly events: (batchId: string) => Promise<readonly FactoryEvent[]>;
}

export interface PacketPage {
  readonly packet: OpenPacket;
  readonly batch: Batch;
  readonly sheet: SheetModel;
  readonly events: readonly FactoryEvent[];
  readonly lastStep: FactoryStep | null;
  readonly nextStep: FactoryStep | null;
}

/** The page for a token, or null when the token opens nothing. */
export async function loadPacketPage(deps: PacketLoadDeps, token: string): Promise<PacketPage | null> {
  if (!isPacketToken(token)) return null;
  const packet = await deps.open(token);
  if (!packet) return null;
  const [{ batch, sources }, settings, events] = await Promise.all([deps.sources(packet.batchId), deps.settings(), deps.events(packet.batchId)]);
  const last = lastStep(events);
  return { packet, batch, sheet: buildSheet(sheetInputOf(batch, sources, settings)), events, lastStep: last, nextStep: nextStep(last) };
}

/** The factory's view of its history: newest first, photos named but never addressed. */
export const historyLines = (events: readonly FactoryEvent[]): readonly Readonly<{ id: string; kind: FactoryEvent["kind"]; note: string; at: string; moved: number }>[] =>
  [...events].reverse().map((e) => ({ id: e.id, kind: e.kind, note: e.note, at: e.at, moved: e.ordersMoved }));
