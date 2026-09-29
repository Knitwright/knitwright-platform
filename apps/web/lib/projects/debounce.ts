/** How long the editor waits after the last change to a choice before sending it. */
export const CHOICE_SETTLE_MS = 350;

/**
 * Holds the newest value for each control until the person stops changing it. Stepping
 * through a radio group with the arrow keys changes it at every step, and only the one they
 * settle on should be sent. Enter and blur send at once. `asked` is true when the person
 * asked for the save with Enter.
 */
export type Settler<T> = Readonly<{
  change: (key: string, value: T) => void;
  flush: (key: string, asked: boolean) => void;
  flushAll: () => void;
  cancel: () => void;
  pending: () => boolean;
}>;

type Waiting<T> = { value: T; timer: ReturnType<typeof setTimeout> };

export const createSettler = <T>(
  send: (key: string, value: T, asked: boolean) => void,
  waitMs: number = CHOICE_SETTLE_MS,
): Settler<T> => {
  const waiting = new Map<string, Waiting<T>>();

  const flush = (key: string, asked: boolean): void => {
    const entry = waiting.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    waiting.delete(key);
    send(key, entry.value, asked);
  };

  return {
    change: (key, value) => {
      const earlier = waiting.get(key);
      if (earlier) clearTimeout(earlier.timer);
      waiting.set(key, { value, timer: setTimeout(() => flush(key, false), waitMs) });
    },
    flush,
    flushAll: () => [...waiting.keys()].forEach((key) => flush(key, false)),
    cancel: () => {
      waiting.forEach((entry) => clearTimeout(entry.timer));
      waiting.clear();
    },
    pending: () => waiting.size > 0,
  };
};
