import type { SupabaseClient } from "@supabase/supabase-js";
import { throwIfFailed } from "./project-reads";
import type { DownloadEntry } from "./export-download";

/**
 * Records one download through the database function, which checks that the user belongs to the
 * design's brand and that the version exists. It uses the server's own client, because no browser
 * role may write to the table. It throws when it cannot record, and then no file is sent.
 */
export async function recordDownload(admin: SupabaseClient, userId: string, entry: DownloadEntry): Promise<void> {
  const { error } = await admin.rpc("record_export_download", {
    p_project_id: entry.projectId,
    p_user_id: userId,
    p_spec_version: entry.version,
    p_format: entry.format,
    p_view: entry.view,
  });
  throwIfFailed(error);
}
