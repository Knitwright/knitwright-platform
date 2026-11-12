import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastQueue, MAX_TOASTS, TOAST_MS } from "./toast-store";

const timers = () => ({
  set: (run: () => void, ms: number) => setTimeout(run, ms),
  clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
});

describe("the life of a toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast, info unless it says otherwise, and tells its listeners", () => {
    const queue = createToastQueue(timers());
    const heard = vi.fn();
    queue.subscribe(heard);
    const id = queue.show({ title: "Saved" });
    expect(queue.list()).toEqual([{ id, title: "Saved", tone: "info" }]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("hides itself after 4 s", () => {
    const queue = createToastQueue(timers());
    queue.show({ tone: "success", title: "Saved" });
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(queue.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(queue.list()).toHaveLength(0);
    expect(TOAST_MS).toBe(4000);
  });

  it("stays while hovered, then gets the rest of its time back", () => {
    const queue = createToastQueue(timers());
    const id = queue.show({ tone: "error", title: "Generation failed" });
    vi.advanceTimersByTime(3000);
    queue.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(queue.list()).toHaveLength(1);
    queue.resume(id);
    vi.advanceTimersByTime(999);
    expect(queue.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(queue.list()).toHaveLength(0);
  });

  it("ignores a second pause, and a resume that was never paused", () => {
    const queue = createToastQueue(timers());
    const id = queue.show({ title: "Copied" });
    queue.resume(id);
    vi.advanceTimersByTime(1000);
    queue.pause(id);
    vi.advanceTimersByTime(1000);
    queue.pause(id);
    queue.resume(id);
    vi.advanceTimersByTime(2999);
    expect(queue.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(queue.list()).toHaveLength(0);
  });

  it("closes at once when dismissed, and a later timer finds nothing to close", () => {
    const queue = createToastQueue(timers());
    const heard = vi.fn();
    const id = queue.show({ title: "Copied" });
    queue.subscribe(heard);
    queue.dismiss(id);
    expect(queue.list()).toHaveLength(0);
    vi.advanceTimersByTime(TOAST_MS);
    queue.dismiss(id);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest few, dropping the oldest", () => {
    const queue = createToastQueue(timers());
    const ids = Array.from({ length: MAX_TOASTS + 2 }, (_, index) => queue.show({ title: `Toast ${index}` }));
    expect(queue.list().map((toast) => toast.id)).toEqual(ids.slice(2));
  });

  it("stops telling a listener that unsubscribed", () => {
    const queue = createToastQueue(timers());
    const heard = vi.fn();
    const stop = queue.subscribe(heard);
    stop();
    queue.show({ title: "Saved" });
    expect(heard).not.toHaveBeenCalled();
  });
});
