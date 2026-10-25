import { z } from "zod";
import { mediaItemSchema, mediaSetSchema } from "@/lib/media/contract";
import type { MediaSetView } from "@/lib/media/view";
import { UNREACHABLE_MESSAGE } from "./copy";

/**
 * The screen's calls to the media routes, kept apart from the markup so they can be tested. Every answer is parsed:
 * a set that carries anything but the view fields (a path to a clean file, say) is refused rather than shown.
 */

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
export type Failure = Readonly<{ ok: false; message: string }>;

const itemView = mediaItemSchema.extend({ href: z.string().nullable() });
const setView = mediaSetSchema.omit({ items: true }).extend({ unlocked: z.boolean(), items: z.array(itemView) });

const failure = z.object({ success: z.literal(false), error: z.object({ message: z.string() }) });
const success = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data });

const FALLBACK = "That did not work. Try again.";

async function call<T extends z.ZodType>(fetcher: Fetch, url: string, init: RequestInit | undefined, data: T): Promise<{ ok: true; data: z.infer<T> } | Failure> {
  try {
    const response = await fetcher(url, { cache: "no-store", ...init });
    const body: unknown = await response.json().catch(() => null);
    const refused = failure.safeParse(body);
    if (refused.success) return { ok: false, message: refused.data.error.message };
    const parsed = success(data).safeParse(body);
    return parsed.success ? { ok: true, data: (parsed.data as { data: z.infer<T> }).data } : { ok: false, message: FALLBACK };
  } catch {
    return { ok: false, message: UNREACHABLE_MESSAGE };
  }
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const base = (projectId: string): string => `/api/projects/${projectId}/media`;

export async function readLatest(projectId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView | null } | Failure> {
  const result = await call(fetcher, base(projectId), undefined, z.object({ set: setView.nullable() }));
  return result.ok ? { ok: true, set: result.data.set } : result;
}

export async function readSet(projectId: string, setId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView } | Failure> {
  const result = await call(fetcher, `${base(projectId)}/${setId}`, undefined, z.object({ set: setView }));
  return result.ok ? { ok: true, set: result.data.set } : result;
}

export async function startSet(projectId: string, fetcher: Fetch = fetch): Promise<{ ok: true; created: boolean; set: MediaSetView } | Failure> {
  const result = await call(fetcher, base(projectId), post({}), z.object({ created: z.boolean(), set: setView }));
  return result.ok ? { ok: true, created: result.data.created, set: result.data.set } : result;
}

/** Spends the credits (the server's gate decides) and reads the set again, which now serves the clean pictures. */
export async function unlockSet(projectId: string, setId: string, fetcher: Fetch = fetch): Promise<{ ok: true; set: MediaSetView } | Failure> {
  const spent = await call(fetcher, `${base(projectId)}/${setId}/unlock`, post({}), z.object({ unlocked: z.literal(true) }).passthrough());
  return spent.ok ? readSet(projectId, setId, fetcher) : spent;
}

export async function startClip(projectId: string, setId: string, view: "scene" | "on_model", fetcher: Fetch = fetch): Promise<{ ok: true; state: "exists" | "started" } | Failure> {
  const result = await call(fetcher, `${base(projectId)}/${setId}/clip`, post({ view }), z.object({ state: z.enum(["exists", "started"]) }).passthrough());
  return result.ok ? { ok: true, state: result.data.state } : result;
}

export type CreditsNote = Readonly<{ enforced: boolean; balance: number; price: number; isPlaceholder: boolean }>;

const summary = z.object({ enforced: z.boolean(), balance: z.number(), prices: z.object({ marketing_media: z.number() }).passthrough(), isPlaceholder: z.boolean() }).passthrough();

/** The price of marketing media and the balance, or null: a credits problem never stops the screen. */
export async function readCredits(fetcher: Fetch = fetch): Promise<CreditsNote | null> {
  const result = await call(fetcher, "/api/credits", undefined, summary);
  return result.ok ? { enforced: result.data.enforced, balance: result.data.balance, price: result.data.prices.marketing_media, isPlaceholder: result.data.isPlaceholder } : null;
}
