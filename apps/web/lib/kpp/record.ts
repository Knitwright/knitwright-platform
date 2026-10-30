import type { PackageRecord } from "./export";

/**
 * Writing one `package_exports` row (migration 20261101040000, plan v5 X5b item 3). The package itself is never
 * stored: the ZIP is sent and thrown away, and this row is the evidence of what was sent — which design version,
 * which factory, how big the ZIP was and the SHA-256 of the whole of it. The same version and factory always give
 * the same bytes, so a stored hash is how a factory's copy is checked against ours.
 *
 * Only `record_package_export` writes the table, and only the server's own key may run it: the function takes the
 * brand from the design, so a design of another brand and a design that does not exist give the same answer.
 */

/** The one database call this needs, so a test runs it without a database. */
export interface PackageExportDb {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

const FAILED = "The production package could not be recorded, so it was not sent.";

/** The arguments of `record_package_export`, in the order the migration declares them. */
export const packageExportArgs = (projectId: string, userId: string, record: PackageRecord): Record<string, unknown> => ({
  p_project_id: projectId,
  p_user_id: userId,
  p_spec_version: record.designVersion,
  p_design_code: record.designCode,
  p_root: record.root,
  p_file_name: record.fileName,
  p_design_hash: record.designHash,
  p_factory_code: record.factoryCode,
  p_kind: record.kind,
  p_generator_version: record.generatorVersion,
  p_zip_sha256: record.zipSha256,
  p_zip_bytes: record.zipBytes,
  p_file_count: record.fileCount,
  p_built_for: record.builtFor,
});

/**
 * Records one export and gives back the row's id. It throws when it cannot record, and then the ZIP is not sent:
 * a package a factory holds that the platform has no record of is a package nobody can check.
 */
export async function recordPackageExport(db: PackageExportDb, projectId: string, userId: string, record: PackageRecord): Promise<string> {
  const { data, error } = await db.rpc("record_package_export", packageExportArgs(projectId, userId, record));
  if (error !== null || typeof data !== "string" || data === "") throw new Error(FAILED, { cause: error ?? data });
  return data;
}
