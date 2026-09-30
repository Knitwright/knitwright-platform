import type { DeletionClient, StorageEntry } from "../client";

/**
 * An in-memory stand-in for the parts of the server's Supabase client that deletion uses. It
 * records every call in order, so tests can check what happened and when.
 */

type RpcAnswer = Readonly<{ data: unknown; error: { code?: string; hint?: string | null; message: string } | null }>;

export type FakeOptions = Readonly<{
  /** The answer for each database function, by name. A function may answer differently each call. */
  rpc?: Readonly<Record<string, RpcAnswer | readonly RpcAnswer[]>>;
  /** Objects in storage, by bucket, as full paths. */
  objects?: Readonly<Record<string, readonly string[]>>;
  /** Buckets whose remove call fails. */
  failRemove?: readonly string[];
  /** Buckets whose list call fails. */
  failList?: readonly string[];
  deleteUserError?: { message: string };
}>;

export type Call =
  | Readonly<{ kind: "rpc"; name: string; args: Record<string, unknown> }>
  | Readonly<{ kind: "remove"; bucket: string; paths: readonly string[] }>
  | Readonly<{ kind: "list"; bucket: string; prefix: string; offset: number }>
  | Readonly<{ kind: "deleteUser"; id: string }>;

const entriesUnder = (paths: readonly string[], prefix: string): StorageEntry[] => {
  const names = new Map<string, boolean>();
  for (const path of paths) {
    if (!path.startsWith(`${prefix}/`)) continue;
    const rest = path.slice(prefix.length + 1);
    const [first, ...more] = rest.split("/");
    names.set(first, more.length === 0 || names.get(first) === true);
  }
  // Supabase lists a folder with a null id and a file with an id.
  return [...names].sort().map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }));
};

export const fakeClient = (options: FakeOptions = {}) => {
  const calls: Call[] = [];
  const store = new Map<string, string[]>(
    Object.entries(options.objects ?? {}).map(([bucket, paths]) => [bucket, [...paths]]),
  );
  const rpcCount = new Map<string, number>();

  const client: DeletionClient = {
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      const answer = options.rpc?.[name];
      const seen = rpcCount.get(name) ?? 0;
      rpcCount.set(name, seen + 1);
      if (answer === undefined) return { data: null, error: { message: `no answer for ${name}` } };
      if (Array.isArray(answer)) return (answer as readonly RpcAnswer[])[Math.min(seen, answer.length - 1)];
      return answer as RpcAnswer;
    },
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          calls.push({ kind: "remove", bucket, paths });
          if (options.failRemove?.includes(bucket)) return { data: null, error: { message: "remove failed" } };
          store.set(bucket, (store.get(bucket) ?? []).filter((path) => !paths.includes(path)));
          return { data: [], error: null };
        },
        list: async (prefix, { limit, offset }) => {
          calls.push({ kind: "list", bucket, prefix, offset });
          if (options.failList?.includes(bucket)) return { data: null, error: { message: "list failed" } };
          return { data: entriesUnder(store.get(bucket) ?? [], prefix).slice(offset, offset + limit), error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id) => {
          calls.push({ kind: "deleteUser", id });
          return { error: options.deleteUserError ?? null };
        },
      },
    },
  };

  return { client, calls, objects: (bucket: string) => [...(store.get(bucket) ?? [])] };
};
