/**
 * A small per-key cache for the factory profile read model (spec: "cached per factory and invalidated on change").
 * Every write through this module's edit path invalidates the factory it touched. A server process that did not
 * make the change still sees it within `ttlMs`, since several processes may serve the app.
 */

export interface KeyedCache<T> {
  get(key: string): Promise<T>;
  invalidate(key: string): void;
  clear(): void;
}

export interface CacheOptions<T> {
  readonly load: (key: string) => Promise<T>;
  readonly ttlMs: number;
  readonly now?: () => number;
}

export function createKeyedCache<T>({ load, ttlMs, now = Date.now }: CacheOptions<T>): KeyedCache<T> {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key) {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const value = load(key);
      entries.set(key, { at: now(), value });
      // A failed load is not kept: the next read tries again.
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    },
    invalidate(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
}
