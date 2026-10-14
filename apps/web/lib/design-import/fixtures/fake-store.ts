import type { DerivedStore } from "../derived";

/** A store of cut pictures that keeps them in memory and gives each a made-up artwork id. Tests only. */
export function fakeStore(options: { failAt?: number } = {}) {
  const added: { id: string; name: string; bytes: number }[] = [];
  const removed: string[] = [];
  let counter = 0;
  const store: DerivedStore = {
    async add(png, name) {
      if (options.failAt !== undefined && counter === options.failAt) throw new Error("the store is down");
      counter += 1;
      const id = `aaaaaaaa-0000-4000-8000-${String(counter).padStart(12, "0")}`;
      added.push({ id, name, bytes: png.byteLength });
      return id;
    },
    async remove(ids) {
      removed.push(...ids);
    },
  };
  return { store, added, removed };
}
