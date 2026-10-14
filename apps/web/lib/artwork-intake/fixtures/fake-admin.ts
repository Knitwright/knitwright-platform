import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/**
 * Test stand-in for the server's storage client: tables and buckets in memory, with just the calls the artwork
 * code makes. It follows the same rules the database does for this feature (the file kinds, the cascade from a
 * file to its artwork, the copy-matches-kind check) so a test can see what would be stored.
 */
export type FakeAdmin = Readonly<{
  admin: SupabaseClient;
  tables: { files: Row[]; user_artworks: Row[] };
  objects: Map<string, Uint8Array>;
  failNext: (what: "upload" | "files-insert" | "artworks-insert" | "remove") => void;
  setUsed: (bytes: number) => void;
}>;

const KINDS = ["artwork", "sketch", "photo", "render", "export", "chart", "pattern", "print", "proof", "roster", "pattern-source", "artwork-print", "artwork-vector"];
const EXPORT_TYPES = ["application/pdf", "image/tiff", "application/json", "text/csv", "application/dxf"];

export function createFakeAdmin(): FakeAdmin {
  const tables = { files: [] as Row[], user_artworks: [] as Row[] };
  const objects = new Map<string, Uint8Array>();
  const failures = new Set<string>();
  let used = 0;

  const cascade = () => {
    const ids = new Set(tables.files.map((file) => file.id));
    tables.user_artworks = tables.user_artworks.filter((art) => ids.has(art.screen_file_id));
  };

  const builder = (name: "files" | "user_artworks") => {
    let filters: ((row: Row) => boolean)[] = [];
    let mode: "select" | "delete" = "select";
    let inserted: Row | null = null;
    let failure: { message: string; code?: string } | null = null;
    const run = () => {
      if (failure) return { data: null, error: failure };
      const rows = tables[name].filter((row) => filters.every((f) => f(row)));
      if (mode === "delete") {
        tables[name] = tables[name].filter((row) => !rows.includes(row));
        if (name === "files") cascade();
        return { data: null, error: null };
      }
      return { data: inserted ? [inserted] : rows, error: null };
    };
    const api = {
      insert(value: Row) {
        const key = name === "files" ? "files-insert" : "artworks-insert";
        if (failures.delete(key)) failure = { message: "insert failed", code: "23503" };
        else if (name === "files" && !KINDS.includes(String(value.kind))) failure = { message: "bad kind" };
        else if (name === "files" && String(value.content_type).includes("svg")) failure = { message: "no svg" };
        else if (name === "files" && value.bucket === "exports" && !EXPORT_TYPES.includes(String(value.content_type))) failure = { message: "bad type" };
        else if (name === "user_artworks" && (value.kind === "raster") === (value.print_file_id === null)) failure = { message: "copy does not match kind" };
        else {
          inserted = name === "files" ? { ...value } : { id: randomUUID(), created_at: new Date().toISOString(), ...value };
          tables[name].push(inserted);
        }
        return api;
      },
      select: () => api,
      delete() {
        mode = "delete";
        return api;
      },
      eq(column: string, value: unknown) {
        filters = [...filters, (row) => row[column] === value];
        return api;
      },
      in(column: string, values: unknown[]) {
        filters = [...filters, (row) => values.includes(row[column])];
        return api;
      },
      order: () => api,
      limit: () => api,
      single: async () => {
        const result = run();
        return failure ? result : { data: (result.data as Row[])[0] ?? null, error: null };
      },
      maybeSingle: async () => {
        const result = run();
        return failure ? result : { data: (result.data as Row[])[0] ?? null, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => resolve(run()),
    };
    return api;
  };

  const admin = {
    rpc: async () => ({ data: used, error: null }),
    from: (name: "files" | "user_artworks") => builder(name),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array) => {
          if (failures.delete("upload")) return { error: { message: "storage down" } };
          objects.set(`${bucket}/${path}`, bytes);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          if (failures.delete("remove")) throw new Error("storage down");
          for (const path of paths) objects.delete(`${bucket}/${path}`);
          return { error: null };
        },
        download: async (path: string) => {
          const bytes = objects.get(`${bucket}/${path}`);
          return bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: "gone" } };
        },
      }),
    },
  } as unknown as SupabaseClient;

  return { admin, tables, objects, failNext: (what) => failures.add(what), setUsed: (bytes) => { used = bytes; } };
}
