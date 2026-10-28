import { readJson } from "@/lib/http/read-json";
import type { MediaSetView } from "@/lib/media/view";
import { UNREACHABLE_MESSAGE } from "./copy";

/**
 * The screen's calls to the media routes, kept apart from the markup so they can be tested. Every answer is checked:
 * a set that carries anything but the view fields (a path to a clean file, say) is refused rather than shown.
 * Hand-written checks, not zod, because zod stays out of client components (tests/architecture/client-weight.test.ts).
 */

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
type Failure = Readonly<{ ok: false; message: string }>;

type Json = Record<string, unknown>;
type Check<T> = (value: unknown) => value is T;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactly = (value: Json, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const orNull = (check: (value: unknown) => boolean) => (value: unknown): boolean => value === null || check(value);
const isString = (value: unknown): boolean => typeof value === "string" && value.length > 0;
const isNumber = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value);
const isOneOf = (...options: readonly string[]) => (value: unknown): boolean => typeof value === "string" && options.includes(value);

const ITEM: Readonly<Record<string, (value: unknown) => boolean>> = {
  id: isString,
  kind: isOneOf("studio_render", "lifestyle", "turntable", "clip"),
  view: isOneOf("front", "back", "flat_lay", "three_quarter", "on_model", "scene"),
  fileId: orNull(isString),
  width: orNull(isNumber),
  height: orNull(isNumber),
  watermarked: (value) => typeof value === "boolean",
  checker: isOneOf("pending", "passed", "rejected", "not_checked"),
  provider: isString,
  costMicrodollars: isNumber,
  href: orNull(isString),
};

const SET: Readonly<Record<string, (value: unknown) => boolean>> = {
  id: isString,
  projectId: isString,
  version: isNumber,
  versionHash: isString,
  status: isOneOf("queued", "running", "succeeded", "failed"),
  error: orNull(isString),
  unlocked: (value) => typeof value === "boolean",
  items: (value) => Array.isArray(value) && value.every(isItem),
};

const matches = (shape: Readonly<Record<string, (value: unknown) => boolean>>, value: unknown): boolean =>
  isObject(value) && hasExactly(value, Object.keys(shape)) && Object.entries(shape).every(([key, check]) => check(value[key]));

const isItem = (value: unknown): boolean => matches(ITEM, value);
const isSetView: Check<MediaSetView> = (value): value is MediaSetView => matches(SET, value);

const FALLBACK = "That did not work. Try again.";

async function call<T>(fetcher: Fetch, url: string, init: RequestInit | undefined, read: (data: Json) => T | null): Promise<{ ok: true; data: T } | Failure> {
  try {
    const response = await fetcher(url, { cache: "no-store", ...init });
    const body: unknown = await readJson(response);
    if (!isObject(body)) return { ok: false, message: FALLBACK };
    if (body.success === false && isObject(body.error) && typeof body.error.message === "string") return { ok: false, message: body.error.message };
    const data = body.success === true && isObject(body.data) ? read(body.data) : null;
    return data === null ? { ok: false, message: FALLBACK } : { ok: true, data };
  } catch {
    return { ok: false, message: UNREACHABLE_MESSAGE };
  }
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const base = (projectId: string): string => `/api/projects/${projectId}/media`;

const setOrNull = (data: Json): MediaSetView | null => (isSetView(data.set) ? data.set : null);

export async function readLatest(projectId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView | null } | Failure> {
  const result = await call(fetcher, base(projectId), undefined, (data) => (data.set === null ? { set: null } : isSetView(data.set) ? { set: data.set } : null));
  return result.ok ? { ok: true, set: result.data.set } : result;
}

export async function readSet(projectId: string, setId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView } | Failure> {
  const result = await call(fetcher, `${base(projectId)}/${setId}`, undefined, setOrNull);
  return result.ok ? { ok: true, set: result.data } : result;
}

export async function startSet(projectId: string, fetcher: Fetch = fetch): Promise<{ ok: true; created: boolean; set: MediaSetView } | Failure> {
  const result = await call(fetcher, base(projectId), post({}), (data) => {
    const set = setOrNull(data);
    return set && typeof data.created === "boolean" ? { created: data.created, set } : null;
  });
  return result.ok ? { ok: true, created: result.data.created, set: result.data.set } : result;
}

/** Spends the credits (the server's gate decides) and reads the set again, which now serves the clean pictures. */
export async function unlockSet(projectId: string, setId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView } | Failure> {
  const spent = await call(fetcher, `${base(projectId)}/${setId}/unlock`, post({}), (data) => (data.unlocked === true ? true : null));
  return spent.ok ? readSet(projectId, setId, fetcher) : spent;
}

export async function startClip(projectId: string, setId: string, view: "scene" | "on_model", fetcher: Fetch = fetch): Promise<{ ok: true; state: "exists" | "started" } | Failure> {
  const result = await call(fetcher, `${base(projectId)}/${setId}/clip`, post({ view }), (data) => (data.state === "exists" || data.state === "started" ? data.state : null));
  return result.ok ? { ok: true, state: result.data } : result;
}

export type CreditsNote = Readonly<{ enforced: boolean; balance: number; price: number; isPlaceholder: boolean }>;

/** The price of marketing media and the balance, or null: a credits problem never stops the screen. */
export async function readCredits(fetcher: Fetch = fetch): Promise<CreditsNote | null> {
  const result = await call(fetcher, "/api/credits", undefined, (data): CreditsNote | null => {
    const price = isObject(data.prices) ? data.prices.marketing_media : undefined;
    return typeof data.enforced === "boolean" && typeof data.balance === "number" && typeof data.isPlaceholder === "boolean" && typeof price === "number"
      ? { enforced: data.enforced, balance: data.balance, price, isPlaceholder: data.isPlaceholder }
      : null;
  });
  return result.ok ? result.data : null;
}
