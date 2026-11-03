/**
 * The browser's one call to `DELETE /api/fabrics/size-map`: put one size label back to the pattern
 * size Knitwright suggests (decision 0124).
 *
 * The route existed with no caller at all, and it is the only way to undo a choice: the page's own
 * form (`saveSizeMapAction`) can set a pattern size and has never been able to take one off, so a
 * brand that typed one by mistake was stuck with "Typed in by you" for good. No zod here, so a
 * client component may import it, and the fetcher is passed in so it can be tested without a
 * browser -- the same arrangement as `lib/artwork-intake/client.ts`.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Which label, for which wearer and cut. The brand comes from the session, never from here. */
export type SizeMapLabel = Readonly<{ label: string; wearer: string; cut: string }>;

export type Outcome = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: string }>;

const GENERIC = "The suggestion could not be put back. Try again.";

export const SIZE_MAP_URL = "/api/fabrics/size-map";

export async function resetPatternSize(fetcher: Fetcher, entry: SizeMapLabel): Promise<Outcome> {
  try {
    const response = await fetcher(SIZE_MAP_URL, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    const body = (await response.json()) as { success?: boolean; error?: { message?: string } };
    if (body.success === true) return { ok: true };
    return { ok: false, reason: body.error?.message ?? GENERIC };
  } catch {
    return { ok: false, reason: GENERIC };
  }
}
