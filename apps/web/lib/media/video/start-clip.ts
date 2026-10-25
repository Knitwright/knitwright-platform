import { makeClip, planClip, type ClipAsk, type ClipDeps } from "./clip";

export type StartClipDeps = ClipDeps &
  Readonly<{
    /** Runs the work after the response, as the photoreal job does. */
    schedule: (work: () => Promise<unknown>) => void;
    /** Gives the reserved cost back. Called when no paid call is made, or the call fails. Never throws. */
    refund: () => Promise<void>;
    timeoutMs?: number;
  }>;

export const CLIP_TIME_LIMIT_MS = 50_000;

/**
 * Starts the clip for a set once. If the clip is already there nothing is called and the reservation is given back, so a second
 * press costs nothing. Otherwise the paid call runs after the response and the browser polls the set; a failed call gives the
 * reservation back.
 */
export async function startClip(deps: StartClipDeps, ask: ClipAsk): Promise<{ state: "exists" | "started" }> {
  const plan = await planClip(deps.store, ask);
  if (plan.state === "exists") {
    await deps.refund();
    return { state: "exists" };
  }
  deps.schedule(async () => {
    const done = await makeClip(deps, ask, plan, AbortSignal.timeout(deps.timeoutMs ?? CLIP_TIME_LIMIT_MS));
    if (!done.ok) await deps.refund();
  });
  return { state: "started" };
}
