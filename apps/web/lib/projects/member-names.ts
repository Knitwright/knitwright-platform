import { z } from "zod";

/**
 * The names of a brand's members, for "Made by" in the tech pack's revision history (owner
 * decision 2026-09-30): the name from the person's profile, else their email address. The
 * database answers only for a brand the reader belongs to, and only with its own members, so
 * no name of another brand's people can reach a document.
 */

export type MemberNames = ReadonlyMap<string, string>;

type Rpc = Readonly<{
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}>;

const rowsSchema = z.array(z.object({ user_id: z.uuid(), name: z.string().min(1) }));

export async function loadMemberNames(client: Rpc, brandId: string): Promise<MemberNames> {
  const { data, error } = await client.rpc("brand_member_names", { p_brand_id: brandId });
  if (error) throw new Error("The names of the brand's members could not be read.", { cause: error });
  return new Map(rowsSchema.parse(data ?? []).map((row) => [row.user_id, row.name]));
}

/** Who made a version, by name, or null when they are not (or no longer) a member of the brand. */
export const madeBy = (userId: string | null, names: MemberNames): string | null =>
  userId === null ? null : (names.get(userId) ?? null);
