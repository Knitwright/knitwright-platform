import type { AfterStore, UploadInput } from "./hooks";

/** The one thing the artwork upload path imports from moderation: screen before storing, then keep the result. */
export type UploadGate = (input: UploadInput) => Promise<AfterStore>;
