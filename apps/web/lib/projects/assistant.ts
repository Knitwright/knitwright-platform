import "server-only";
import { assistantSigningSecret, getEnv } from "@/lib/config/env";
import { proposalKey } from "@/lib/intent/proposal-token";
import { chooseModels, type ModelChoice } from "@/lib/providers/select";
import { standInModels } from "@/lib/providers/stand-in";

/**
 * The assistant's configuration as the running server has it. Keys are optional (owner
 * action A3): without the key for the chosen model, the assistant is shown as not available.
 */

/** One model call may take this long. Two calls (the first and the retry) stay under 60 s (decision 0002). */
export const MODEL_TIMEOUT_MS = 25_000;

/** The configured models, or the browser tests' stand-in when AI_PROVIDER_STUB is on. */
export const assistantModels = (): ModelChoice => {
  const env = getEnv();
  return env.AI_PROVIDER_STUB === "on" ? standInModels() : chooseModels(env);
};

export const assistantAvailable = (): boolean => assistantModels().primary !== null;

/** The key proposals are signed with: a dedicated secret when set, else derived from the server's secret. */
export const proposalSigningKey = (): Buffer => proposalKey(assistantSigningSecret(getEnv()));

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
