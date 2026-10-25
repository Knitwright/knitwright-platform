import { randomUUID } from "node:crypto";
import type { SetStatus } from "./contract";
import type { ItemRecord, MediaFiles, MediaStore, NewItem, SetRecord } from "./ports";

/** In-memory stand-ins for tests. They keep the rules the database functions keep. */

export function memoryStore(): MediaStore & { sets: Map<string, SetRecord>; history: string[] } {
  const sets = new Map<string, SetRecord>();
  const history: string[] = [];
  const keyOf = (b: string, p: string, h: string) => `${b}|${p}|${h}`;
  const byKey = new Map<string, string>();
  const patch = (id: string, change: Partial<SetRecord>) => {
    const old = sets.get(id);
    if (old) sets.set(id, { ...old, ...change });
  };
  return {
    sets,
    history,
    async start(input) {
      const key = keyOf(input.brandId, input.projectId, input.versionHash);
      const existing = byKey.get(key);
      if (existing) {
        const found = sets.get(existing);
        if (found?.status === "failed") {
          patch(existing, { status: "queued", error: null });
          history.push("queued");
          return { id: existing, created: true };
        }
        return { id: existing, created: false };
      }
      const id = randomUUID();
      byKey.set(key, id);
      sets.set(id, { id, brandId: input.brandId, projectId: input.projectId, version: input.version, versionHash: input.versionHash, status: "queued", error: null, unlocked: false, items: [] });
      history.push("queued");
      return { id, created: true };
    },
    async move(setId, from, to, error) {
      const found = sets.get(setId);
      if (!found || !from.includes(found.status)) return false;
      patch(setId, { status: to as SetStatus, error: to === "failed" ? (error ?? "The media could not be made.") : null });
      history.push(to);
      return true;
    },
    async putItem(setId, item: NewItem) {
      const found = sets.get(setId);
      if (!found || found.status !== "running") throw new Error("The set is not running.");
      const id = randomUUID();
      const record: ItemRecord = { id, ...item };
      const others = found.items.filter((entry) => !(entry.kind === item.kind && entry.view === item.view));
      patch(setId, { items: [...others, record] });
      return id;
    },
    async unlock(setId) {
      const found = sets.get(setId);
      if (!found || found.status !== "succeeded" || found.unlocked) return false;
      patch(setId, { unlocked: true });
      history.push("unlocked");
      return true;
    },
    async read(brandId, projectId, setId) {
      const found = sets.get(setId);
      return found && found.brandId === brandId && found.projectId === projectId ? found : null;
    },
    async latest(brandId, projectId) {
      return [...sets.values()].reverse().find((entry) => entry.brandId === brandId && entry.projectId === projectId) ?? null;
    },
  };
}

export function memoryFiles(): MediaFiles & { watermarked: Map<string, Uint8Array>; clean: Map<string, Uint8Array>; cleanReads: string[] } {
  const watermarked = new Map<string, Uint8Array>();
  const clean = new Map<string, Uint8Array>();
  const cleanReads: string[] = [];
  return {
    watermarked,
    clean,
    cleanReads,
    async saveWatermarked(png) {
      const id = randomUUID();
      watermarked.set(id, png);
      return id;
    },
    async saveClean(path, png) {
      clean.set(path, png);
    },
    async readWatermarked(fileId) {
      return watermarked.get(fileId) ?? null;
    },
    async readClean(path) {
      cleanReads.push(path);
      return clean.get(path) ?? null;
    },
    async remove({ fileIds, cleanPaths }) {
      for (const id of fileIds) watermarked.delete(id);
      for (const path of cleanPaths) clean.delete(path);
    },
  };
}
