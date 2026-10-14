import type { SupabaseClient } from "@supabase/supabase-js";

/** A small in-memory Supabase stand-in for the design import service: select (eq, gte, order), insert, update. Tests only. */
type Row = Record<string, unknown>;
type Failure = { code?: string; message: string };

export function fakeDb(seed: Row[] = [], now: () => string = () => "2026-10-15T00:00:00.000Z") {
  const rows: Row[] = seed.map((r) => ({ ...r }));
  const failures = new Map<string, Failure>();
  let counter = 0;

  function builder() {
    let op = "select";
    let payload: Row = {};
    const filters: ((r: Row) => boolean)[] = [];
    let wantSingle: "single" | "maybe" | null = null;
    let order: [string, boolean] | null = null;
    const run = (): { data: unknown; error: Failure | null } => {
      const failure = failures.get(op);
      if (failure) return { data: null, error: failure };
      let out: Row[] = [];
      if (op === "insert") {
        counter += 1;
        const row = { id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, status: "ready", accepted_stack: null, accepted_layer_ids: null, accepted_at: null, created_at: now(), ...payload };
        rows.push(row);
        out = [row];
      } else {
        out = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") for (const r of out) Object.assign(r, payload);
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
      insert: (p: Row) => ((op = "insert"), (payload = p), api),
      update: (p: Row) => ((op = "update"), (payload = p), api),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), api),
      order: (c: string, o?: { ascending?: boolean }) => ((order = [c, o?.ascending !== false]), api),
      single: () => ((wantSingle = "single"), api),
      maybeSingle: () => ((wantSingle = "maybe"), api),
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return api;
  }
  return { client: { from: () => builder() } as unknown as SupabaseClient, rows, failOn: (op: string, error: Failure) => void failures.set(op, error) };
}
