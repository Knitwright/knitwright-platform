import "server-only";
import { factorySheetPdf } from "@/lib/ops/factory-sheet/pdf";
import { buildSheet } from "@/lib/ops/factory-sheet/model";
import { printZip } from "@/lib/ops/factory-sheet/print-zip";
import type { Batch } from "@/lib/ops/rows";
import { loadSettings } from "@/lib/ops/service";
import { loadBatchSources, releaseFilesOf, sheetInputOf } from "@/lib/ops/sheet-data";
import { printFileBuilder } from "@/lib/releases/builder";
import { adminClient } from "@/lib/server/deps";
import type { PacketLoadDeps } from "./load";
import { noPatterns, type PatternSource } from "./patterns";
import { listFactoryEvents, openPacket } from "./service";
import { jobZip } from "./zip";

/**
 * Joins the factory's page and downloads to the database, storage and the ops file builders, with the server's
 * key. A token reaches the database only through the job packet functions; everything after that is read for the
 * batch the token's packet names. The database tests and the end-to-end test cover this file.
 */

/** Where the factory's patterns come from. The production package assembler (X5) replaces this in a later wave. */
export const patternSource: PatternSource = noPatterns;

export const packetLoadDeps = (): PacketLoadDeps => {
  const admin = adminClient();
  return {
    open: (token) => openPacket(admin, token),
    sources: (batchId) => loadBatchSources(admin, batchId),
    settings: () => loadSettings(admin),
    events: (batchId) => listFactoryEvents(admin, batchId),
  };
};

/** The job sheet PDF of the batch a token opens, or null. */
export async function packetSheet(token: string): Promise<{ batch: Batch; pdf: Uint8Array } | null> {
  const admin = adminClient();
  const packet = await openPacket(admin, token);
  if (!packet) return null;
  const { batch, sources } = await loadBatchSources(admin, packet.batchId);
  return { batch, pdf: await factorySheetPdf(buildSheet(sheetInputOf(batch, sources, await loadSettings(admin)))) };
}

/** The ZIP of the batch a token opens: job sheet, print files and patterns. Null when the token opens nothing. */
export async function packetZip(token: string): Promise<{ batch: Batch; zip: Uint8Array } | null> {
  const admin = adminClient();
  const packet = await openPacket(admin, token);
  if (!packet) return null;
  const { batch, sources } = await loadBatchSources(admin, packet.batchId);
  const sheet = await factorySheetPdf(buildSheet(sheetInputOf(batch, sources, await loadSettings(admin))));
  const prints = await printZip(releaseFilesOf(sources, (brandId) => printFileBuilder({ client: admin, admin }, brandId)));
  const patterns = await patternSource.filesFor(batch, sources.map((s) => s.order));
  return { batch, zip: jobZip({ sheet, printZip: prints, patterns, patternNote: patterns.length === 0 ? patternSource.note : null }) };
}
