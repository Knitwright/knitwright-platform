import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";

/**
 * The one way a file leaves storage: a link that stops working after a minute. It is
 * made with the user's own client, so the database's rules decide as well as this code.
 */

export const LINK_LIFETIME_SECONDS = 60;

const NO_SUCH_FILE = "That file does not exist.";

export type DownloadLink = Readonly<{ url: string; expiresInSeconds: number }>;

const fileRow = z.object({ bucket: z.string(), path: z.string() });

const noSuchFile = () => new AppError("not_found", NO_SUCH_FILE);

const isNotFound = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const { status, statusCode } = error as Readonly<{ status?: unknown; statusCode?: unknown }>;
  return Number(statusCode ?? status) === 404 || Number(status) === 404;
};

/**
 * What to throw when storage did not give a link. Only a "not found" answer means the
 * file is missing. Anything else is a fault, so it is kept as the cause and gets logged.
 */
export const linkFailure = (error: unknown): Error =>
  isNotFound(error)
    ? noSuchFile()
    : new Error("The link could not be made.", { cause: error });

/**
 * A link to a file of the brand the user is working in. A file of any other brand,
 * a file that does not exist and an id that is not an id all get the same answer.
 */
export const createDownloadLink = async (
  client: SupabaseClient,
  brandId: string,
  fileId: string,
): Promise<DownloadLink> => {
  if (!z.uuid().safeParse(fileId).success) throw noSuchFile();

  const { data, error } = await client
    .from("files")
    .select("bucket, path")
    .eq("id", fileId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw new Error("The file's record could not be read.", { cause: error });
  if (!data) throw noSuchFile();

  const file = fileRow.parse(data);
  const signed = await client.storage
    .from(file.bucket)
    .createSignedUrl(file.path, LINK_LIFETIME_SECONDS);
  if (signed.error || !signed.data?.signedUrl) throw linkFailure(signed.error);

  return { url: signed.data.signedUrl, expiresInSeconds: LINK_LIFETIME_SECONDS };
};
