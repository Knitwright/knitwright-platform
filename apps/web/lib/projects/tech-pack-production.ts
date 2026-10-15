import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtworkRecord } from "@/lib/artwork-intake";
import { listArtworks } from "@/lib/artwork-intake/service";
import type { ImportReport } from "@/lib/design-import/report";
import { loadPrintProfile } from "@/lib/print/profiles/service";
import type { StoredPrintProfile } from "@/lib/print/profiles/schemas";
import type { SignOff, StrikeOff } from "@/lib/proofs/types";
import { listSignOffs, listStrikeOffs } from "@/lib/proofs/service";
import { getRelease, listReleases, type ReleaseSummary } from "@/lib/releases/service";
import type { GarmentSpec } from "@/lib/garment";
import type { PlacedAsset, ProductionInput, SignOffRecord, StrikeOffRecord } from "@/lib/techpack/production/input";
import { stackOf } from "@/lib/techpack/production/stack-source";
import type { ArtworkStack } from "@/lib/artwork-stack";
import { formatDate, isoDay } from "./dates";
import { madeBy, type MemberNames } from "./member-names";

/**
 * What the production services give the tech pack (plans/production-outputs.md, W5 phase B): the pictures a design places,
 * the print house's profile, the newest release with its strike-off and sign-offs, and the reading a design came from.
 * The pattern, fabric test and print files are not here yet: they are supplied once the services that make them (the pattern
 * library, the fabric library and the print builder) hand their records over, and the readiness list says so until then.
 */

export interface AcceptedImport {
  readonly report: ImportReport;
  readonly acceptedLayerIds: readonly string[];
  readonly acceptedBy: string;
  readonly acceptedAt: string;
}

/** Each read the loader makes, so the logic can be tested without a database. */
export interface ProductionReaders {
  artworks(): Promise<readonly ArtworkRecord[]>;
  printProfile(): Promise<StoredPrintProfile>;
  releases(): Promise<readonly ReleaseSummary[]>;
  releaseFiles(releaseId: string): Promise<number>;
  strikeOffs(): Promise<readonly StrikeOff[]>;
  signOffs(): Promise<readonly SignOff[]>;
  acceptedImports(): Promise<readonly AcceptedImport[]>;
}

export interface ProductionContext {
  readonly spec: GarmentSpec;
  readonly names: MemberNames;
}

/** A read that fails leaves its part out. The document is still made, and its list of what is missing says so. */
const quietly = async <T>(read: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await read();
  } catch {
    return undefined;
  }
};

const assetIdsOf = (stack: ArtworkStack): Set<string> =>
  new Set(
    stack.layers.flatMap((layer) => {
      if (layer.kind === "image-fill") return [layer.assetId];
      return layer.kind === "graphic" && layer.source.kind === "asset" ? [layer.source.assetId] : [];
    }),
  );

const assetOf = (record: ArtworkRecord): PlacedAsset => ({ id: record.id, label: record.label, kind: record.kind, widthPx: record.widthPx, heightPx: record.heightPx, dpiMeta: record.dpiMeta });

function strikeOffOf(strikeOffs: readonly StrikeOff[]): StrikeOffRecord | null {
  const latest = [...strikeOffs]
    .filter((entry) => entry.status === "accepted" && entry.decidedByName !== null)
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  if (latest === undefined || latest.decidedByName === null) return null;
  const on = latest.decidedOn ?? latest.receivedAt ?? latest.requestedAt;
  return { releaseId: latest.releaseId, name: latest.decidedByName, date: formatDate(on), dateIso: isoDay(on), result: latest.decisionNote === "" ? null : latest.decisionNote };
}

const signOffOf = (entry: SignOff): SignOffRecord => ({ role: entry.role, name: entry.signerName, date: formatDate(entry.signedOn), dateIso: isoDay(entry.signedOn) });

/** The reading the design came from: an accepted import that names a layer of the design that was read from a picture. */
function pictureOf(imports: readonly AcceptedImport[], stack: ArtworkStack, names: MemberNames): ProductionInput["picture"] {
  const read = new Set(stack.layers.filter((layer) => layer.provenance === "read-from-image").map((layer) => layer.id));
  const mine = imports.filter((entry) => entry.acceptedLayerIds.some((id) => read.has(id))).sort((a, b) => (a.acceptedAt < b.acceptedAt ? 1 : -1));
  const latest = mine[0];
  if (latest === undefined) return null;
  const who = madeBy(latest.acceptedBy, names);
  return {
    report: latest.report,
    acceptedLayerIds: [...new Set(mine.flatMap((entry) => entry.acceptedLayerIds))],
    // Someone no longer in the brand has no name to show, so the acceptance does not count as one by name.
    acceptedBy: who === null ? null : { name: who, date: formatDate(latest.acceptedAt), dateIso: isoDay(latest.acceptedAt) },
  };
}

async function releaseParts(readers: ProductionReaders): Promise<Pick<ProductionInput, "release" | "strikeOff" | "signOffs">> {
  const [releases, strikeOffs] = await Promise.all([quietly(() => readers.releases()), quietly(() => readers.strikeOffs())]);
  const newest = releases?.[0];
  const files = newest === undefined ? undefined : await quietly(() => readers.releaseFiles(newest.id));
  const signOffs = newest === undefined ? undefined : await quietly(() => readers.signOffs());
  return {
    ...(releases === undefined ? {} : { release: newest === undefined || files === undefined ? null : { id: newest.id, files, createdOn: formatDate(newest.createdAt) } }),
    ...(strikeOffs === undefined ? {} : { strikeOff: strikeOffOf(strikeOffs) }),
    ...(releases !== undefined && newest === undefined ? { signOffs: [] } : {}),
    ...(newest === undefined || signOffs === undefined ? {} : { signOffs: signOffs.filter((entry) => entry.releaseId === newest.id).map(signOffOf) }),
  };
}

export async function loadProduction(readers: ProductionReaders, context: ProductionContext): Promise<ProductionInput> {
  const stack = stackOf(context.spec, {});
  const [artworks, profile, imports, release] = await Promise.all([
    stack === null ? undefined : quietly(() => readers.artworks()),
    quietly(() => readers.printProfile()),
    stack === null ? undefined : quietly(() => readers.acceptedImports()),
    releaseParts(readers),
  ]);
  const wanted = stack === null ? new Set<string>() : assetIdsOf(stack);
  const { minDpi: lowest, ...printProfile } = profile ?? ({} as Partial<StoredPrintProfile>);
  return {
    ...(artworks === undefined ? {} : { assets: artworks.filter((record) => wanted.has(record.id)).map(assetOf) }),
    ...(profile === undefined || lowest === undefined ? {} : { printProfile: printProfile as NonNullable<ProductionInput["printProfile"]>, minDpi: { value: lowest, source: profile.source } }),
    ...(imports === undefined || stack === null ? {} : { picture: pictureOf(imports, stack, context.names) }),
    ...release,
  };
}

/** The reads, from the signed-in person's own client, so the database's rules decide what they see. */
export function readersFor(client: SupabaseClient, brandId: string, projectId: string): ProductionReaders {
  return {
    artworks: () => listArtworks(client, brandId),
    printProfile: () => loadPrintProfile(client, brandId),
    releases: () => listReleases(client, brandId, projectId),
    releaseFiles: async (releaseId) => (await getRelease(client, brandId, projectId, releaseId)).snapshot.files.length,
    strikeOffs: () => listStrikeOffs(client, brandId, projectId),
    signOffs: () => listSignOffs(client, brandId, projectId),
    acceptedImports: async () => {
      const { data, error } = await client
        .from("design_imports")
        .select("report, accepted_layer_ids, accepted_by, accepted_at")
        .eq("brand_id", brandId)
        .eq("status", "accepted")
        .order("accepted_at", { ascending: false })
        .limit(50);
      if (error) throw new Error("The accepted readings could not be listed.", { cause: error });
      return (data ?? []).flatMap((row: { report: ImportReport; accepted_layer_ids: string[] | null; accepted_by: string | null; accepted_at: string | null }) =>
        row.accepted_by === null || row.accepted_at === null ? [] : [{ report: row.report, acceptedLayerIds: row.accepted_layer_ids ?? [], acceptedBy: row.accepted_by, acceptedAt: row.accepted_at }],
      );
    },
  };
}
