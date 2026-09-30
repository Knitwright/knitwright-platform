import { z } from "zod";
import { failureFromDatabase } from "@/lib/projects/database-errors";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { DatabaseFailure, DeletionClient, StoredObject } from "./client";
import { emptyBrandFolders, removeObjects } from "./storage";

/**
 * Deleting a design, and deleting an account, with every stored file that goes with them.
 *
 * Storage objects are removed before the rows that point at them. If anything fails part way,
 * what is left is rows that point at missing files, which the app already treats as missing, and
 * running the deletion again finishes it. Objects that nothing points at are never left behind.
 * See supabase/migrations/20260930010000_deletion.sql.
 */

export const SHARED_BRAND_MESSAGE =
  "A brand you belong to has other members. Ask them to take it over before you delete your account.";

export const ACCOUNT_NOT_FOUND_MESSAGE = "That account does not exist.";

const objectsSchema = z.array(z.object({ bucket: z.string().min(1), path: z.string().min(1) }));
const idsSchema = z.array(z.uuid());

/** Checks what a database function returned, since the client does not. */
const read = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data ?? []);
  if (!parsed.success) throw new Error("The database gave an unexpected answer.");
  return parsed.data;
};

const call = async (
  client: DeletionClient,
  name: string,
  args: Record<string, unknown>,
  failure: (error: DatabaseFailure) => AppError,
): Promise<unknown> => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw failure(error);
  return data;
};

export type DesignToDelete = Readonly<{ brandId: string; userId: string; projectId: string }>;

/** Deletes a design, its versions, its download records and the pictures only it uses. */
export const deleteDesign = async (
  client: DeletionClient,
  design: DesignToDelete,
): Promise<{ removedFiles: number }> => {
  const args = { p_project_id: design.projectId, p_brand_id: design.brandId, p_user_id: design.userId };

  const planned = read(objectsSchema, await call(client, "project_deletion_files", args, failureFromDatabase));
  await removeObjects(client, planned);

  const removed = read(objectsSchema, await call(client, "delete_project", args, failureFromDatabase));
  const key = ({ bucket, path }: StoredObject) => `${bucket}\n${path}`;
  const done = new Set(planned.map(key));
  // Artwork saved to the design after the plan was read. Its row is gone now, so its object goes.
  await removeObjects(client, removed.filter((object) => !done.has(key(object))));

  return { removedFiles: removed.length };
};

const accountFailure = (error: DatabaseFailure): AppError => {
  if (error.hint === "shared_brand") return new AppError("conflict", SHARED_BRAND_MESSAGE);
  if (error.code === "P0002") return new AppError("not_found", ACCOUNT_NOT_FOUND_MESSAGE);
  return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
};

/**
 * Deletes an account and everything it owns: every brand it belongs to, with their designs,
 * versions, download records, files and stored objects, its place on the sign-up allow list,
 * and finally its sign-in record.
 */
export const deleteAccount = async (
  client: DeletionClient,
  account: Readonly<{ userId: string }>,
): Promise<{ deletedBrands: number }> => {
  const args = { p_user_id: account.userId };

  const planned = read(idsSchema, await call(client, "account_deletion_brands", args, accountFailure));
  await emptyBrandFolders(client, planned);

  const deleted = read(idsSchema, await call(client, "delete_account_data", args, accountFailure));
  // Anything uploaded between the two steps. The brands are gone, so nothing more can arrive.
  await emptyBrandFolders(client, deleted);

  const { error } = await client.auth.admin.deleteUser(account.userId);
  if (error) throw new Error("The account could not be deleted.", { cause: error });

  return { deletedBrands: deleted.length };
};
