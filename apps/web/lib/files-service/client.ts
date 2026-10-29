import { ANSWER_SCHEMAS, healthAnswerSchema, type Answered, type Failure, type FilesService, type FilesServiceShapes } from "./contract";
import type { FilesServiceOperation } from "./operations";
import { signServiceToken, TOKEN_HEADER } from "./token";

/**
 * The HTTP client for the files service (decision 0070). It posts JSON to
 * `<FILES_SERVICE_URL>/v1/<operation>` with a signed service token and parses the answer against
 * the operation's schema. NOTHING CALLS IT YET: the service does not exist, so
 * `filesServiceFrom` gives the stub while `FILES_SERVICE_URL` is unset. It is here so the seam is
 * written down and testable, with a `fetch` passed in so no test reaches the network.
 */

export type ClientConfig = Readonly<{
  url: string;
  secret: string;
  /** Passed in, so tests use a stand-in and no test can reach the network. */
  fetch: typeof globalThis.fetch;
  /** Passed in, so a signed token is the same in every run of a test. */
  nowSeconds: () => number;
  timeoutMs?: number;
}>;

export const DEFAULT_TIMEOUT_MS = 55_000;

const failure = (failure: Failure["failure"], message: string): Failure => ({ ok: false, failure, message });

/** A response that is not 2xx. 4xx is the platform's own fault and is never retried. */
const fromStatus = (status: number): Failure =>
  status === 401 || status === 403
    ? failure("refused", "The files service refused the service token.")
    : status >= 400 && status < 500
      ? failure("refused", `The files service refused the request (${status}).`)
      : failure("service_error", `The files service answered ${status}.`);

/** One POST, with the token signed over the exact body sent. */
async function post(config: ClientConfig, path: string, body: unknown, signal?: AbortSignal): Promise<Response | Failure> {
  const text = JSON.stringify(body ?? {});
  const signed = signServiceToken(config.secret, path, text, config.nowSeconds());
  const timeout = AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await config.fetch(`${config.url.replace(/\/+$/, "")}/v1/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", [TOKEN_HEADER]: signed.token },
      body: text,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
    });
  } catch (cause) {
    const aborted = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    return failure(aborted ? "timed_out" : "unreachable", aborted ? "The files service did not answer in time." : "The files service could not be reached.");
  }
}

/** Reads a response body as the schema says it should be. A shape we do not know is a failure. */
async function parsed<T>(response: Response, schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }): Promise<Answered<T>> {
  if (!response.ok) return fromStatus(response.status);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return failure("bad_answer", "The files service answered with something that is not JSON.");
  }
  const result = schema.safeParse(json);
  return result.success && result.data !== undefined ? { ok: true, answer: result.data } : failure("bad_answer", "The files service answered in a shape this version does not know.");
}

export function createFilesServiceClient(config: ClientConfig): FilesService {
  return {
    name: "files-service-http",
    health: async () => {
      const response = await post(config, "health", {});
      // A Response has an `ok` of its own, so the two are told apart by type, not by a property.
      return response instanceof Response ? parsed(response, healthAnswerSchema) : response;
    },
    call: async <K extends FilesServiceOperation>(operation: K, request: FilesServiceShapes[K]["request"], signal?: AbortSignal) => {
      const response = await post(config, operation, request, signal);
      return response instanceof Response ? parsed(response, ANSWER_SCHEMAS[operation]) : response;
    },
  };
}
