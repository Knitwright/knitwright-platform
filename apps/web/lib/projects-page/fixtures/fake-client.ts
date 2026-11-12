import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A stand-in for the database client in this directory's tests: each table answers with its rows
 * whatever the filters, each function with its answer, and storage signs every path. It records
 * the functions called, so a test can see what was asked.
 */

type Answer = Readonly<{ data: unknown; error: Readonly<{ code?: string; hint?: string; message: string }> | null }>;

export type FakeSetup = Readonly<{
  tables?: Readonly<Record<string, unknown>>;
  rpc?: Readonly<Record<string, Answer>>;
  /** Buckets whose signing fails. */
  unsignable?: readonly string[];
}>;

const builder = (answer: Answer) => {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "is", "in", "not", "order", "limit"]) chain[name] = () => chain;
  chain.maybeSingle = async () => ({ data: Array.isArray(answer.data) ? (answer.data[0] ?? null) : answer.data, error: answer.error });
  chain.then = (resolve: (value: Answer) => unknown) => Promise.resolve(answer).then(resolve);
  return chain;
};

export const fakeClient = (setup: FakeSetup = {}) => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => {
      const rows = setup.tables?.[table];
      if (typeof rows === "object" && rows !== null && "__fail" in rows) return builder({ data: null, error: { message: String(rows.__fail) } });
      return builder({ data: rows ?? [], error: null });
    },
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      return setup.rpc?.[name] ?? { data: null, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: readonly string[]) =>
          setup.unsignable?.includes(bucket)
            ? { data: null, error: { message: "no" } }
            : { data: paths.map((path) => ({ path, signedUrl: `https://files.test/${bucket}/${path}`, error: null })), error: null },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
};

/** A table that fails to read. */
export const failingTable = (message = "boom") => ({ __fail: message });
