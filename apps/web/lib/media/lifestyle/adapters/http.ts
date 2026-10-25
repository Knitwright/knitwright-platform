import { ProviderError } from "@/lib/providers/image-provider";

export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** Largest picture accepted back from a provider, in bytes. */
export const MAX_BYTES = 20 * 1024 * 1024;

/** 4xx other than a timeout or a rate limit: the key, the account or the content. Retrying cannot help. */
const refusedStatus = (status: number): boolean => status >= 400 && status < 500 && status !== 408 && status !== 429;

/** Sends one request. A failure becomes a `ProviderError` whose text is safe to show; the provider's own words go to `cause` for the log. */
export async function send(fetcher: Fetch, what: string, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    throw new ProviderError(`${what} could not be reached.`, false, { cause: error });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ProviderError(`${what} refused the request (${response.status}).`, refusedStatus(response.status), { cause: detail.slice(0, 500) });
  }
  return response;
}

export const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

/** Bytes from base64 text, with or without a `data:` prefix, refusing anything over the size limit. */
export function fromBase64(value: string, what: string): Uint8Array {
  const data = value.replace(/^data:[^;,]+;base64,/, "");
  if ((data.length * 3) / 4 > MAX_BYTES) throw new ProviderError(`${what} returned a picture that is too large.`, false);
  const bytes = new Uint8Array(Buffer.from(data, "base64"));
  if (bytes.length === 0) throw new ProviderError(`${what} returned no picture.`, false);
  return bytes;
}

export async function readBytes(response: Response, what: string): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new ProviderError(`${what} returned a picture that is too large.`, false);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new ProviderError(`${what} returned no usable picture.`, false);
  return bytes;
}

export const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new ProviderError("The time ran out.", false));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), reject(new ProviderError("The time ran out.", false))), { once: true });
  });
