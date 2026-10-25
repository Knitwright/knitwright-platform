import { designVersionHash } from "@/lib/credits/version-hash";

/** A set is keyed by this, the same hash credits use, so one spend covers one version. */
export const mediaVersionHash = designVersionHash;
