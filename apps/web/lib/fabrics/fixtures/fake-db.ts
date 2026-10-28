import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A small in-memory stand-in for the Supabase client, enough for the fabric service: select with
 * eq and in filters and order, insert, update, upsert and delete. Tests only. It gives rows ids and
 * timestamps the way the database defaults do, and can be told to fail on a table.
 */
type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };

type FakeDb = Readonly<{
  client: SupabaseClient;
  tables: Record<string, Row[]>;
  failOn: (table: string, op: string, error: Failure) => void;
  calls: string[];
}>;

export function fakeDb(seed: Record<string, Row[]> = {}): FakeDb {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  const failures = new Map<string, Failure>();
  const calls: string[] = [];
  let counter = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

  function builder(table: string) {
    const rows = (tables[table] ??= []);
    let op = "select";
    let payload: Row[] = [];
    let conflict: string[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    let order: [string, boolean] | null = null;
    let wantSingle: "single" | "maybe" | null = null;

    const run = (): { data: unknown; error: Failure | null } => {
      calls.push(`${table}.${op}`);
      const failure = failures.get(`${table}.${op}`);
      if (failure) return { data: null, error: failure };
      const match = rows.filter((r) => filters.every((f) => f(r)));
      let out: Row[] = [];
      if (op === "select") out = match;
      if (op === "insert" || op === "upsert") {
        for (const item of payload) {
          const existing = op === "upsert" ? rows.find((r) => conflict.every((c) => r[c] === item[c])) : undefined;
          const unique = op === "insert" ? rows.find((r) => table === "base_fabrics" && r.brand_id === item.brand_id && String(r.name).toLowerCase() === String(item.name).toLowerCase()) : undefined;
          if (unique) return { data: null, error: { code: "23505", message: "duplicate" } };
          if (existing) {
            Object.assign(existing, item);
            out.push(existing);
          } else {
            const row = { id: nextId(), created_at: `2026-10-15T00:00:${String(counter).padStart(2, "0")}Z`, ...item };
            rows.push(row);
            out.push(row);
          }
        }
      }
      if (op === "update") {
        for (const r of match) Object.assign(r, payload[0]);
        out = match;
      }
      if (op === "delete") {
        for (const r of match) rows.splice(rows.indexOf(r), 1);
        out = match;
      }
      if (order) {
        const [col, asc] = order;
        out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1));
      }
      if (wantSingle) {
        if (out.length === 0) return wantSingle === "single" ? { data: null, error: { message: "no rows" } } : { data: null, error: null };
        return { data: out[0], error: null };
      }
      return { data: out, error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = Array.isArray(p) ? p : [p]), api),
      upsert: (p: Row | Row[], o?: { onConflict?: string }) => ((op = "upsert"), (payload = Array.isArray(p) ? p : [p]), (conflict = (o?.onConflict ?? "").split(",")), api),
      update: (p: Row) => ((op = "update"), (payload = [p]), api),
      delete: () => ((op = "delete"), api),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
      order: (c: string, o?: { ascending?: boolean }) => ((order = [c, o?.ascending !== false]), api),
      single: () => ((wantSingle = "single"), api),
      maybeSingle: () => ((wantSingle = "maybe"), api),
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return api;
  }

  return {
    client: { from: builder } as unknown as SupabaseClient,
    tables,
    failOn: (table, op, error) => void failures.set(`${table}.${op}`, error),
    calls,
  };
}
