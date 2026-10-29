import { createFilesServiceClient } from "./client";
import type { FilesService } from "./contract";
import { createStubFilesService } from "./stub";

/**
 * The files-service seam (decision 0070, plan v5 owner decision 2). The future Python service is
 * the Sportswear model; it is not wired in. While `FILES_SERVICE_URL` is unset — which it is
 * everywhere today, including CI — this gives the stub, which answers "not available" for every
 * operation. Nothing in the platform calls it yet except the health check.
 */

export type { FilesService, Answered, Failure, FailureKind, FileRef, ServiceFinding, HealthAnswer, FilesServiceShapes } from "./contract";
export { ANSWER_SCHEMAS, FAILURES, RENDER_SCENES, RENDER_VIEWS } from "./contract";
export { ENGINE_NOTES, FILES_SERVICE_OPERATIONS, PAID_OPERATIONS, isPaid, type FilesServiceOperation } from "./operations";
export { NOT_AVAILABLE, createStubFilesService, notAvailableMessage } from "./stub";
export { createFilesServiceClient, type ClientConfig } from "./client";
export { ESTIMATED_COST, meteredFilesService, type MeterLike, type Payer } from "./metered";
export { TOKEN_HEADER, signServiceToken, verifyServiceToken } from "./token";

export type FilesServiceEnv = Readonly<{ FILES_SERVICE_URL?: string; FILES_SERVICE_TOKEN?: string }>;

/**
 * The real client when both the address and the secret are set, the stub otherwise. A URL with no
 * secret is a misconfiguration, not a reason to call an unauthenticated service, so it gives the
 * stub too.
 */
export function filesServiceFrom(env: FilesServiceEnv, fetchFn: typeof globalThis.fetch = globalThis.fetch): FilesService {
  const url = env.FILES_SERVICE_URL ?? "";
  const secret = env.FILES_SERVICE_TOKEN ?? "";
  if (url === "" || secret === "") return createStubFilesService();
  return createFilesServiceClient({ url, secret, fetch: fetchFn, nowSeconds: () => Date.now() / 1000 });
}

/** True when the platform is configured to reach a files service at all. */
export const filesServiceConfigured = (env: FilesServiceEnv): boolean => (env.FILES_SERVICE_URL ?? "") !== "" && (env.FILES_SERVICE_TOKEN ?? "") !== "";
