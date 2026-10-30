import "server-only";
import { getEnv } from "@/lib/config/env";
import type { FilesService } from "./contract";
import { filesServiceConfigured, filesServiceFrom } from "./index";

/**
 * The files service the server would use (decision 0070, plan v5 owner decision 2). Both
 * `FILES_SERVICE_URL` and `FILES_SERVICE_TOKEN` are optional and both are unset everywhere today,
 * so this is the stub, which answers "not available" for every operation. Nothing calls it: it is
 * here so the one place that reads the environment is written down and the seam has a single entry.
 */
export const filesService = (): FilesService => filesServiceFrom(getEnv());

/** True when an address and a secret are both set, so a screen can say the service is not here yet. */
export const filesServiceAvailable = (): boolean => filesServiceConfigured(getEnv());
