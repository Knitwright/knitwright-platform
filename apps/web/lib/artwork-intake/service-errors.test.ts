import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createAssetReader } from "./reader";
import { changeArtwork, checkArtworkTile, deleteArtwork, getArtworkDetail, listArtworks } from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const ID = "44444444-4444-4444-8444-444444444444";

/** A client whose every query answers with the same result. */
const answering = (result: { data: unknown; error: unknown }): SupabaseClient => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  for (const name of ["select", "eq", "in", "order", "limit", "insert", "delete"]) query[name] = chain;
  query.maybeSingle = async () => result;
  query.single = async () => result;
  query.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return { from: () => query, rpc: async () => ({ data: 0, error: null }) } as unknown as SupabaseClient;
};

const failing = answering({ data: null, error: { message: "database down" } });
const empty = answering({ data: null, error: null });

describe("when the database fails", () => {
  it("says the artwork could not be read, and keeps the cause", async () => {
    await expect(listArtworks(failing, BRAND)).rejects.toThrow("could not be listed");
    await expect(createAssetReader(failing, BRAND).getAsset(ID)).rejects.toThrow("could not be read");
    await expect(getArtworkDetail(failing, BRAND, ID)).rejects.toThrow("could not be read");
    await expect(deleteArtwork(failing, BRAND, ID)).rejects.toThrow("could not be read");
    await expect(checkArtworkTile(failing, { brandId: BRAND, userId: "u" }, ID)).rejects.toThrow("could not be read");
    await expect(changeArtwork(failing, { brandId: BRAND, userId: "u" }, ID, { action: "remove-white-background" }, false)).rejects.toThrow("could not be read");
  });

  it("gives not found for an artwork that is not there, and an empty list for none", async () => {
    await expect(getArtworkDetail(empty, BRAND, ID)).rejects.toMatchObject({ code: "not_found" });
    expect(await listArtworks(empty, BRAND)).toEqual([]);
    expect(await createAssetReader(empty, BRAND).getAsset(ID)).toBeNull();
  });
});
