/**
 * The life of a toast (docs/spec/10-design-system.md §8 "Toasts"), apart from React so it can be
 * tested with fake timers: a toast hides itself after 4 s, and stays while it is hovered or has
 * focus, then gets the rest of its time back when the pointer leaves.
 */

export type ToastTone = "success" | "error" | "info";

export type ToastInput = Readonly<{
  tone?: ToastTone;
  title: string;
  body?: string;
  /** "Retry" on an error, for example. Pressing it also closes the toast. */
  action?: Readonly<{ label: string; onAction: () => void }>;
}>;

export type Toast = Readonly<ToastInput & { id: string; tone: ToastTone }>;

export const TOAST_MS = 4000;
/** More than this many at once and the oldest goes. */
export const MAX_TOASTS = 3;

type Timers = Readonly<{
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
  now: () => number;
}>;

type Clock = { handle: unknown; startedAt: number; remaining: number; paused: boolean };

export type ToastQueue = Readonly<{
  show: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  list: () => readonly Toast[];
  subscribe: (listener: () => void) => () => void;
}>;

const defaultTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export function createToastQueue(timers: Timers = defaultTimers, ms = TOAST_MS): ToastQueue {
  let toasts: readonly Toast[] = [];
  let counter = 0;
  const clocks = new Map<string, Clock>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const dismiss = (id: string) => {
    const clock = clocks.get(id);
    if (clock) timers.clear(clock.handle);
    clocks.delete(id);
    if (!toasts.some((toast) => toast.id === id)) return;
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
  };

  const start = (id: string, remaining: number) => {
    clocks.set(id, { handle: timers.set(() => dismiss(id), remaining), startedAt: timers.now(), remaining, paused: false });
  };

  const show = (input: ToastInput): string => {
    counter += 1;
    const id = `toast-${counter}`;
    toasts = [...toasts, { ...input, tone: input.tone ?? "info", id }];
    start(id, ms);
    emit();
    while (toasts.length > MAX_TOASTS) dismiss(toasts[0].id);
    return id;
  };

  const pause = (id: string) => {
    const clock = clocks.get(id);
    if (!clock || clock.paused) return;
    timers.clear(clock.handle);
    clocks.set(id, { ...clock, paused: true, remaining: Math.max(0, clock.remaining - (timers.now() - clock.startedAt)) });
  };

  const resume = (id: string) => {
    const clock = clocks.get(id);
    if (clock?.paused) start(id, clock.remaining);
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { show, dismiss, pause, resume, list: () => toasts, subscribe };
}
