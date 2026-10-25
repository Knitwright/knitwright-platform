import type { VideoType } from "./sniff";

/** Where videos are kept. `files.ts` implements it with the server's key; tests use a map. */
export interface VideoFiles {
  save(path: string, bytes: Uint8Array, type: VideoType): Promise<void>;
  /** Read with the server's own key. Called only for a file the caller may serve. */
  read(path: string): Promise<Uint8Array | null>;
  remove(paths: readonly string[]): Promise<void>;
}
