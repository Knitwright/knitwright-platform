/**
 * The parts of the server's own Supabase client that deletion uses. Written out here so the
 * steps can be tested without a database, and so it is plain which powers deletion needs.
 */

export type DatabaseFailure = Readonly<{ code?: string; hint?: string | null; message: string }>;

/** One entry of a storage listing. Folders have no id. */
export type StorageEntry = Readonly<{ name: string; id: string | null }>;

type Answer<T> = Readonly<{ data: T | null; error: { message: string } | null }>;

export type DeletionClient = Readonly<{
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<Readonly<{ data: unknown; error: DatabaseFailure | null }>>;
  storage: Readonly<{
    from: (bucket: string) => Readonly<{
      remove: (paths: string[]) => PromiseLike<Answer<unknown>>;
      list: (
        prefix: string,
        options: { limit: number; offset: number },
      ) => PromiseLike<Answer<readonly StorageEntry[]>>;
    }>;
  }>;
  auth: Readonly<{
    admin: Readonly<{
      deleteUser: (id: string) => PromiseLike<Readonly<{ error: { message: string } | null }>>;
    }>;
  }>;
}>;

/** A stored object, named by its bucket and its path in the bucket. */
export type StoredObject = Readonly<{ bucket: string; path: string }>;
