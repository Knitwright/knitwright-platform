import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/** What each bucket takes, as the migrations set it. Anything else is refused, as the real bucket does. */
export const BUCKET_TYPES: Readonly<Record<string, readonly string[]>> = {
  uploads: ["image/png", "image/jpeg"],
  images: ["image/png", "image/jpeg"],
  exports: ["application/pdf", "application/zip", "application/dxf", "image/tiff", "text/csv", "application/json"],
};

export type Filter = readonly [column: string, value: unknown];

/** A small in-memory stand-in for the database and storage, which also records the filters every query used. */
export function createFakeSupabase(seed: Readonly<{ files?: Row[]; user_artworks?: Row[] }> = {}, options: Readonly<{ failInsertOn?: string; usedBytes?: number }> = {}) {
  const tables: Record<string, Row[]> = { files: [...(seed.files ?? [])], user_artworks: [...(seed.user_artworks ?? [])] };
  const objects = new Map<string, Readonly<{ bytes: Uint8Array; contentType: string }>>();
  const queries: { table: string; kind: string; filters: Filter[] }[] = [];
  let counter = 0;

  class Query implements PromiseLike<{ data: unknown; error: unknown }> {
    private filters: Filter[] = [];
    private within: readonly [string, readonly unknown[]] | null = null;
    private row: Row | null = null;
    private mode: "select" | "insert" | "delete" = "select";
    private returning = false;
    private pick: "many" | "one" | "maybe" = "many";

    constructor(private readonly table: string) {}

    select(): this {
      this.returning = true;
      return this;
    }
    insert(row: Row): this {
      this.mode = "insert";
      this.row = row;
      return this;
    }
    delete(): this {
      this.mode = "delete";
      return this;
    }
    eq(column: string, value: unknown): this {
      this.filters.push([column, value]);
      return this;
    }
    in(column: string, values: readonly unknown[]): this {
      this.within = [column, values];
      return this;
    }
    order(): this {
      return this;
    }
    limit(): this {
      return this;
    }
    single(): this {
      this.pick = "one";
      return this;
    }
    maybeSingle(): this {
      this.pick = "maybe";
      return this;
    }

    private run(): { data: unknown; error: unknown } {
      queries.push({ table: this.table, kind: this.mode, filters: [...this.filters] });
      const rows = tables[this.table] ?? (tables[this.table] = []);
      const matches = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v) && (!this.within || this.within[1].includes(r[this.within[0]])));
      if (this.mode === "insert") {
        if (options.failInsertOn === this.table) return { data: null, error: { message: "insert failed", code: "XX000" } };
        counter += 1;
        const stored = { id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, created_at: "2026-10-14T00:00:00Z", ...this.row };
        rows.push(stored);
        return { data: this.returning ? (this.pick === "many" ? [stored] : stored) : null, error: null };
      }
      if (this.mode === "delete") {
        tables[this.table] = rows.filter((r) => !matches.includes(r));
        return { data: null, error: null };
      }
      if (this.pick === "many") return { data: matches, error: null };
      if (this.pick === "one" && matches.length !== 1) return { data: null, error: { message: "no row" } };
      return { data: matches[0] ?? null, error: null };
    }

    then<A, B>(ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null) {
      return Promise.resolve(this.run()).then(ok, no);
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: options.usedBytes ?? 0, error: null }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array, opts: { contentType?: string }) => {
          const type = opts.contentType ?? "";
          if (!BUCKET_TYPES[bucket]?.includes(type)) return { error: { message: `mime type ${type} is not supported` } };
          objects.set(`${bucket}/${path}`, { bytes, contentType: type });
          return { error: null };
        },
        download: async (path: string) => {
          const found = objects.get(`${bucket}/${path}`);
          return found ? { data: new Blob([new Uint8Array(found.bytes)]), error: null } : { data: null, error: { message: "not found" } };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) objects.delete(`${bucket}/${path}`);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;

  return { client, tables, objects, queries };
}
