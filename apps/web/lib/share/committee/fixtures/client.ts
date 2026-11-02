import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A stand-in for the Supabase client, for the tests of `service.ts`. It answers a chain of
 * `from(...).select(...).eq(...)...` with the rows the test gave for that table, and records every
 * call, so a test can prove the brand was always part of the question. It reaches no network and no
 * database; the real queries are proved against the real database in
 * `tests/integration/committee-signup.test.ts`.
 */

export type Rows = Readonly<Record<string, readonly Record<string, unknown>[]>>;

export interface Recorded {
  readonly table: string;
  readonly calls: readonly Readonly<{ method: string; args: readonly unknown[] }>[];
}

export interface FakeClient {
  readonly client: SupabaseClient;
  readonly asked: readonly Recorded[];
}

const CHAIN = ["select", "eq", "in", "is", "order", "limit", "not", "neq"] as const;

/** A client that answers from `rows` and remembers what it was asked. */
export function fakeClient(rows: Rows, error: Readonly<{ code?: string; message: string }> | null = null): FakeClient {
  const asked: Recorded[] = [];
  const client = {
    from(table: string) {
      const calls: { method: string; args: unknown[] }[] = [];
      const record: Recorded = { table, calls };
      asked.push(record);
      const answer = { data: rows[table] ?? [], error };
      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve),
        maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error }),
        single: async () => ({ data: (rows[table] ?? [])[0] ?? null, error }),
      };
      for (const method of CHAIN) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, asked };
}

/** Every value the chain was filtered on, so a test can prove the brand is one of them. */
export const filteredOn = (record: Recorded): readonly unknown[] => record.calls.flatMap((call) => call.args);
