import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRoster, hasErrors } from "@/lib/orders/checks";
import { rosterContextOf } from "@/lib/orders/context";
import { rosterHash } from "@/lib/orders/hash";
import { getTeamOrder, type StoredOrder } from "@/lib/orders/service";
import type { PrintFileBuilder } from "@/lib/production/contract";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { buildSnapshot } from "./build";
import { compareToRelease, type ReorderReport } from "./reorder";
import type { ReleaseBody, ReorderBody } from "./schemas";
import { listSignOffs, listStrikeOffs } from "@/lib/proofs/service";
import { createRelease, getRelease } from "./service";
import { checkFabricTestIds } from "./test-ids";
import { releaseView, type ReleaseView } from "./view";

type Who = Readonly<{ brandId: string; userId: string }>;
type Clients = Readonly<{ client: SupabaseClient; admin: SupabaseClient }>;

/** The builder is made from the team list, which the player files are made from, and the pattern the release names. */
export type BuilderFor = (context: { projectId: string; roster: StoredOrder["rows"] | null; patternBlockId: string; patternBlockVersion: number }) => PrintFileBuilder;

/**
 * Freezes a release. A team list with problems is refused first, because a release is for good.
 * The design version and the team list are read here, never taken from the request, so a release
 * cannot claim a version or a roster it was not made from.
 */
export async function freezeRelease(clients: Clients, who: Who, projectId: string, body: ReleaseBody, builderFor: BuilderFor): Promise<{ id: string; number: number; files: number }> {
  const project = await getProject(clients.client, who.brandId, projectId);
  const order = body.orderId ? await getTeamOrder(clients.client, who.brandId, projectId, body.orderId) : null;
  if (order && hasErrors(checkRoster(order.rows, rosterContextOf(project.spec)))) {
    throw new AppError("invalid_input", "The team list has problems. Fix them before the release is made.");
  }
  await checkFabricTestIds(clients.client, who.brandId, projectId, body.fabricTestIds);
  const roster = order?.rows ?? null;
  const snapshot = await buildSnapshot(
    { specVersion: project.currentVersion, patternBlockId: body.patternBlockId, patternBlockVersion: body.patternBlockVersion, fabricTestIds: body.fabricTestIds, printProfile: body.printProfile, roster, files: body.files },
    builderFor({ projectId, roster, patternBlockId: body.patternBlockId, patternBlockVersion: body.patternBlockVersion }),
  );
  const created = await createRelease(clients.admin, { ...who, projectId, label: body.label, snapshot, fileSpecs: body.files, orderId: body.orderId ?? null });
  return { ...created, files: snapshot.files.length };
}

async function currentRoster(client: SupabaseClient, brandId: string, projectId: string, orderId: string | null): Promise<StoredOrder["rows"] | null> {
  if (orderId === null) return null;
  try {
    return (await getTeamOrder(client, brandId, projectId, orderId)).rows;
  } catch (error) {
    // An erased team list is a finding to report, not a failure of the reorder.
    if (error instanceof AppError && error.code === "not_found") return null;
    throw error;
  }
}

/**
 * Builds a release's files again from the settings frozen with it and compares each with its
 * hash. The settings the person gives are today's; the report says what differs and why. Nothing
 * is sent anywhere.
 */
export async function checkReorder(client: SupabaseClient, brandId: string, projectId: string, releaseId: string, body: ReorderBody, builderFor: BuilderFor): Promise<ReorderReport> {
  const [release, project] = await Promise.all([getRelease(client, brandId, projectId, releaseId), getProject(client, brandId, projectId)]);
  const roster = await currentRoster(client, brandId, projectId, body.orderId ?? release.orderId);
  return compareToRelease(
    release.snapshot,
    release.fileSpecs,
    {
      specVersion: project.currentVersion,
      patternBlockId: body.patternBlockId,
      patternBlockVersion: body.patternBlockVersion,
      fabricTestIds: body.fabricTestIds,
      printProfile: body.printProfile,
      rosterHash: roster === null ? null : rosterHash(roster),
    },
    builderFor({ projectId, roster, patternBlockId: body.patternBlockId, patternBlockVersion: body.patternBlockVersion }),
  );
}

/** One release as its page shows it. */
export async function openRelease(client: SupabaseClient, brandId: string, projectId: string, releaseId: string): Promise<ReleaseView> {
  const [release, signOffs, strikeOffs] = await Promise.all([
    getRelease(client, brandId, projectId, releaseId),
    listSignOffs(client, brandId, projectId),
    listStrikeOffs(client, brandId, projectId),
  ]);
  return releaseView(release, signOffs, strikeOffs);
}
