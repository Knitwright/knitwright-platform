import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { recordDownload } from "./export-record";

const PROJECT = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const fake = (error: { code?: string; message: string } | null) => {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: null, error };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};

describe("recording a download", () => {
  it("calls the database function with the design, the user, the version, the format and the view", async () => {
    const { client, calls } = fake(null);

    await recordDownload(client, "user-1", { projectId: PROJECT, version: 3, format: "svg", view: "back" });

    expect(calls).toEqual([
      {
        name: "record_export_download",
        args: { p_project_id: PROJECT, p_user_id: "user-1", p_spec_version: 3, p_format: "svg", p_view: "back" },
      },
    ]);
  });

  it("sends no view for a format that has none", async () => {
    const { client, calls } = fake(null);

    await recordDownload(client, "user-1", { projectId: PROJECT, version: 1, format: "pdf", view: null });

    expect(calls[0]?.args).toMatchObject({ p_view: null });
  });

  it("says not found when the design is not the user's, in the words the page uses", async () => {
    const { client } = fake({ code: "P0002", message: "That design does not exist." });

    await expect(recordDownload(client, "user-1", { projectId: PROJECT, version: 1, format: "pdf", view: null })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("throws an app error with the general message for a failure it does not know, and keeps the cause for the log", async () => {
    const { client } = fake({ code: "XX000", message: "connection refused" });

    const failure = await recordDownload(client, "user-1", { projectId: PROJECT, version: 1, format: "pdf", view: null }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "internal", message: "Something went wrong on our side. Try again." });
  });
});
