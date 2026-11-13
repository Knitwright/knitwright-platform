/**
 * WHAT THE TOAST SAYS AFTER SEND (decision 0149; `08` v3.3 "Toast", prototype e44, `10` §8).
 *
 * The words come from what really happened, as `runFlowAction` reports it: the credits spent and the
 * credits given back (`lib/flows/run.ts` refunds a failed board before the next one starts). So the
 * toast can say "No credits were used" only when nothing was spent, and names a refund when there
 * was one. When the run was never started -- refused by the server, or the network failed -- no
 * charge can have been made, and it says so.
 */

export type ToastWords = Readonly<{ tone: "success" | "error" | "info"; title: string; body: string }>;

/** What `runFlowAction` answers on success (lib/flows/actions.ts). */
export type RunReply = Readonly<{ assets: number; spent: number; refunded: number; reason: string | null }>;

export const FAILED_TITLE = "Generation failed";

const credits = (n: number): string => `${n} credit${n === 1 ? "" : "s"}`;

/** "No credits were used." or "3 credits were refunded." -- the money line of a failure. */
export function moneyLine(spent: number, refunded: number): string {
  if (refunded > 0 && spent === 0) return `${credits(refunded)} ${refunded === 1 ? "was" : "were"} refunded.`;
  if (refunded > 0) return `${credits(refunded)} ${refunded === 1 ? "was" : "were"} refunded; ${credits(spent)} ${spent === 1 ? "was" : "were"} used.`;
  if (spent > 0) return `${credits(spent)} ${spent === 1 ? "was" : "were"} used.`;
  return "No credits were used.";
}

const sentence = (text: string): string => {
  const trimmed = text.trim();
  return trimmed === "" || /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/** The toast for a run that came back. */
export function runToast(reply: RunReply, what: "image" | "video"): ToastWords {
  if (reply.reason !== null || reply.assets === 0) {
    const why = sentence(reply.reason ?? "Please try again later");
    return { tone: "error", title: FAILED_TITLE, body: `${why} ${moneyLine(reply.spent, reply.refunded)}` };
  }
  const made = what === "video" ? "Your video is on the canvas." : reply.assets === 1 ? "Your image is on the canvas." : `${reply.assets} pictures are on the canvas.`;
  return { tone: "success", title: what === "video" ? "Video ready" : "Image ready", body: `${made} ${moneyLine(reply.spent, 0)}` };
}

/** The toast for a press the server refused before any run started, with its own reason. */
export const refusedToast = (reason: string): ToastWords => ({ tone: "error", title: FAILED_TITLE, body: `${sentence(reason)} No credits were used.` });

/** The toast for a press that never reached the server. */
export const unreachedToast = (): ToastWords => ({
  tone: "error",
  title: FAILED_TITLE,
  body: "Please try again later. No credits were used.",
});
