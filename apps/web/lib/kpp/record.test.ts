import { describe, expect, it } from "vitest";
import { exportPackage } from "./export";
import { fixtureSources, JSY_BATCH, JSY_INPUT } from "./fixtures/jsy-ss-01";
import { packageExportArgs, recordPackageExport, type PackageExportDb } from "./record";

/** The `package_exports` row (migration 20261101040000). The database tests cover the function itself. */

const PROJECT = "11111111-1111-4111-8111-111111111111";

const db = (answer: { data: unknown; error: { message: string } | null }) => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client: PackageExportDb = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      return answer;
    },
  };
  return { client, calls };
};

const recordOf = async (input = JSY_INPUT) => {
  const built = await exportPackage(input, fixtureSources());
  if (!built.ok) throw new Error("The package did not build.");
  return built.record;
};

describe("recordPackageExport", () => {
  it("names every column the migration takes, from the record the export made", async () => {
    const record = await recordOf();
    const { client, calls } = db({ data: "22222222-2222-4222-8222-222222222222", error: null });

    const id = await recordPackageExport(client, PROJECT, "u1", record);

    expect(id).toBe("22222222-2222-4222-8222-222222222222");
    expect(calls[0]?.fn).toBe("record_package_export");
    expect(calls[0]?.args).toEqual({
      p_project_id: PROJECT,
      p_user_id: "u1",
      p_spec_version: 3,
      p_design_code: "ACME_Home_Kit",
      p_root: "KPP_ACME_Home_Kit_v3_SKT-01",
      p_file_name: "KPP_ACME_Home_Kit_v3_SKT-01.zip",
      p_design_hash: "a".repeat(64),
      p_factory_code: "SKT-01",
      p_kind: "sample",
      p_generator_version: "kpp-1.0.0",
      p_zip_sha256: record.zipSha256,
      p_zip_bytes: record.zipBytes,
      p_file_count: record.fileCount,
      p_built_for: "2026-10-25T09:30:00.000Z",
    });
  });

  it("tells a batch from a sample, so the two rows of one version are told apart", async () => {
    const args = packageExportArgs(PROJECT, "u1", await recordOf(JSY_BATCH));
    expect(args.p_kind).toBe("batch");
    expect(args.p_file_name).toBe("KPP_ACME_Home_Kit_v3_SKT-01_batch.zip");
  });

  it("throws when the row cannot be written, so the ZIP is not sent unrecorded", async () => {
    const record = await recordOf();
    await expect(recordPackageExport(db({ data: null, error: { message: "no" } }).client, PROJECT, "u1", record)).rejects.toThrow(/could not be recorded/);
    await expect(recordPackageExport(db({ data: "", error: null }).client, PROJECT, "u1", record)).rejects.toThrow(/could not be recorded/);
  });
});
