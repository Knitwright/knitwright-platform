import type { CheckerVerdict, MediaKind, MediaView, SetStatus } from "./contract";

/** What the media code needs from the database and storage. `service.ts` implements them; tests use in-memory ones. */

export type ItemRecord = Readonly<{
  id: string;
  kind: MediaKind;
  view: MediaView;
  fileId: string | null;
  cleanPath: string | null;
  width: number | null;
  height: number | null;
  checker: CheckerVerdict;
  provider: string;
  costMicrodollars: number;
}>;

export type SetRecord = Readonly<{
  id: string;
  brandId: string;
  projectId: string;
  version: number;
  versionHash: string;
  status: SetStatus;
  error: string | null;
  unlocked: boolean;
  items: readonly ItemRecord[];
}>;

export type NewItem = Omit<ItemRecord, "id">;

export interface MediaStore {
  /** Starts a set for the version once. `created` is false when one already exists (and has not failed). */
  start(input: Readonly<{ brandId: string; projectId: string; userId: string; version: number; versionHash: string }>): Promise<{ id: string; created: boolean }>;
  /** Moves a set on from one of these states. False when it was not in one. */
  move(setId: string, from: readonly SetStatus[], to: "running" | "succeeded" | "failed", error?: string): Promise<boolean>;
  putItem(setId: string, item: NewItem): Promise<string>;
  /** True when this call unlocked the set; false when it was already unlocked or is not finished. */
  unlock(setId: string, userId: string): Promise<boolean>;
  /** A set of the brand's design, with its items, or null. */
  read(brandId: string, projectId: string, setId: string): Promise<SetRecord | null>;
  /** The newest set of the design, or null. */
  latest(brandId: string, projectId: string): Promise<SetRecord | null>;
}

export interface MediaFiles {
  /** Stores the watermarked picture as an ordinary file of the brand and returns its id. */
  saveWatermarked(png: Uint8Array): Promise<string>;
  /** Keeps the clean picture where no member can read it. */
  saveClean(path: string, png: Uint8Array): Promise<void>;
  readWatermarked(fileId: string): Promise<Uint8Array | null>;
  /** Reads a clean picture with the server's own key. Called only for an unlocked set. */
  readClean(path: string): Promise<Uint8Array | null>;
  /** Removes pictures a failed set could not keep. */
  remove(input: Readonly<{ fileIds: readonly string[]; cleanPaths: readonly string[] }>): Promise<void>;
}
