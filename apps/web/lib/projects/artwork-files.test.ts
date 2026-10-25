import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Artwork, SpecAction } from "@/lib/garment";
import { NO_SUCH_FILE } from "@/lib/storage/links";
import { dropUnreadableArtwork, filesInAction, refuseUnreadableArtwork, unreadableFileIds } from "./artwork-files";
import type { ReadSpec } from "./project-reads";

/** A client whose `files` query answers with these rows, or this error, and records the ids it was asked about. */
const clientWith = (rows: readonly { id: string }[], error: unknown = null) => {
  const asked: string[][] = [];
  const query = {
    select: () => query,
    eq: () => query,
    in: (_column: string, ids: string[]) => {
      asked.push(ids);
      return Promise.resolve({ data: error ? null : rows, error });
    },
  };
  return { client: { from: () => query } as unknown as SupabaseClient, asked };
};

const art = (id: string, source: unknown): Artwork => ({ id, name: `Art ${id}`, source }) as unknown as Artwork;
const file = (id: string, fileId: string): Artwork => art(id, { kind: "file", fileId });

describe("filesInAction", () => {
  it("names the picture of added or updated artwork", () => {
    expect(filesInAction({ type: "add-artwork", artwork: file("a", "f1") } as unknown as SpecAction)).toEqual(["f1"]);
    expect(filesInAction({ type: "update-artwork", artwork: file("a", "f2") } as unknown as SpecAction)).toEqual(["f2"]);
  });

  it("names nothing for artwork that is not a stored file, or for another kind of change", () => {
    expect(filesInAction({ type: "add-artwork", artwork: art("a", { kind: "text" }) } as unknown as SpecAction)).toEqual([]);
    expect(filesInAction({ type: "remove-artwork", id: "a" } as unknown as SpecAction)).toEqual([]);
  });
});

describe("unreadableFileIds", () => {
  it("asks nothing when no file is named", async () => {
    const { client, asked } = clientWith([]);
    expect((await unreadableFileIds(client, "b", [])).size).toBe(0);
    expect(asked).toEqual([]);
  });

  it("asks once for each distinct id and returns the ones the brand cannot read", async () => {
    const { client, asked } = clientWith([{ id: "f1" }]);
    const missing = await unreadableFileIds(client, "b", ["f1", "f2", "f2"]);
    expect([...missing]).toEqual(["f2"]);
    expect(asked).toEqual([["f1", "f2"]]);
  });

  it("treats a missing result as nothing readable", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ in: () => Promise.resolve({ data: null, error: null }) }) }) }) }) } as unknown as SupabaseClient;
    expect([...(await unreadableFileIds(client, "b", ["f1"]))]).toEqual(["f1"]);
  });

  it("keeps a database fault as the cause", async () => {
    const cause = { message: "down" };
    const { client } = clientWith([], cause);
    await expect(unreadableFileIds(client, "b", ["f1"])).rejects.toMatchObject({ message: "The files could not be checked.", cause });
  });
});

describe("refuseUnreadableArtwork", () => {
  const action = { type: "add-artwork", artwork: file("a", "f1") } as unknown as SpecAction;

  it("gives the general missing file sentence when the picture is not the brand's", async () => {
    expect(await refuseUnreadableArtwork(clientWith([]).client, "b", action)).toBe(NO_SUCH_FILE);
  });

  it("allows the change when the picture is readable", async () => {
    expect(await refuseUnreadableArtwork(clientWith([{ id: "f1" }]).client, "b", action)).toBeNull();
  });
});

describe("dropUnreadableArtwork", () => {
  const read = (artwork: Artwork[]): ReadSpec => ({ spec: { artwork }, dropped: [] }) as unknown as ReadSpec;

  it("returns the design as it is when every picture is readable", async () => {
    const input = read([file("a", "f1"), art("t", { kind: "text" })]);
    expect(await dropUnreadableArtwork(clientWith([{ id: "f1" }]).client, "b", input)).toBe(input);
  });

  it("removes artwork whose picture is gone and says so, leaving the input unchanged", async () => {
    const input = read([file("a", "f1"), file("b", "f2"), art("t", { kind: "text" })]);
    const out = await dropUnreadableArtwork(clientWith([{ id: "f1" }]).client, "b", input);
    expect(out.spec.artwork.map((entry) => entry.id)).toEqual(["a", "t"]);
    expect(out.dropped).toEqual([{ kind: "artwork", id: "b", message: "Art b was removed, because its picture could not be found." }]);
    expect(input.spec.artwork).toHaveLength(3);
  });
});
