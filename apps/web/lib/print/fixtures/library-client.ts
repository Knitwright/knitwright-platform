import type { SupabaseClient } from "@supabase/supabase-js";
import { MEN_RUN, syntheticPieces } from "@/lib/pattern-library/fixtures/synthetic-set";

type Row = Record<string, unknown>;

export const BRAND = "11111111-1111-4111-8111-111111111111";
export const BLOCK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** The row a block has in the library. */
export const blockRow = (over: Row = {}): Row => ({
  id: BLOCK_ID,
  product_key: "team-jersey",
  wearer: "men",
  cut: "mens",
  name: "Team jersey",
  kind: "pieces",
  version: 3,
  source: "technician-upload",
  sizes: [...MEN_RUN],
  derived: [],
  warnings: [],
  questions: [],
  size_map: null,
  programme_note: null,
  landmark_overrides: {},
  created_at: "2026-10-14T10:00:00Z",
  ...over,
});

export const sizeRows = (blockId = BLOCK_ID, sizes: readonly (typeof MEN_RUN)[number][] = MEN_RUN): Row[] =>
  sizes.map((size, position) => ({ size_label: size, position, pieces: syntheticPieces(size), measurements: [], skipped: [], checks: [], dxf_file_id: null, block_id: blockId, brand_id: BRAND }));

/** Tables in memory with the calls the library makes: select, eq, order, limit, maybeSingle. For tests. */
export function libraryClient(tables: Readonly<Record<string, Row[]>>, objects: Readonly<Record<string, Uint8Array>> = {}): SupabaseClient {
  const from = (name: string) => {
    let filters: ((row: Row) => boolean)[] = [];
    const api = {
      select: () => api,
      eq(column: string, value: unknown) {
        filters = [...filters, (row) => row[column] === value || column === "brand_id"];
        return api;
      },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => ({ data: (tables[name] ?? []).filter((row) => filters.every((f) => f(row)))[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: (tables[name] ?? []).filter((row) => filters.every((f) => f(row))), error: null }),
    };
    return api;
  };
  const storage = {
    from: (bucket: string) => ({
      download: async (path: string) => {
        const bytes = objects[`${bucket}/${path}`];
        return bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: "gone" } };
      },
    }),
  };
  return { from, storage } as unknown as SupabaseClient;
}
