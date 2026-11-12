"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { createToastQueue, type Toast, type ToastInput, type ToastQueue, type ToastTone } from "./toast-store";

/**
 * Toasts (docs/spec/10-design-system.md §8): dark `text` fill, white 15/500, r-lg, 12 × 18
 * padding, top centre 28 px from the top. Each hides after 4 s and stays while hovered or
 * focused. An error toast is an alert and may carry Retry; the others are polite status.
 *
 * `useToast().show({ tone: "error", title: "Generation failed", body: "No credits were used.",
 * action: { label: "Retry", onAction } })`. An error shown here is never the only place a field
 * error appears (§9): those go under the field.
 */

type ToastApi = Pick<ToastQueue, "show" | "dismiss">;

const ToastContext = createContext<ToastApi | null>(null);
const NONE: readonly Toast[] = [];

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const ICON_TONE: Readonly<Record<ToastTone, string>> = {
  success: "bg-ok text-on-dark",
  error: "bg-bad text-on-dark",
  info: "bg-electric text-on-dark",
};

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queue] = useState(() => createToastQueue());
  const toasts = useSyncExternalStore(queue.subscribe, queue.list, () => NONE);
  return (
    <ToastContext.Provider value={queue}>
      {children}
      <ToastViewport toasts={toasts} queue={queue} />
    </ToastContext.Provider>
  );
}

/** The toast functions. Outside a provider it throws, so a missing provider is found at once. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a <ToastProvider> above it (app/layout.tsx has one).");
  return api;
}

function ToastViewport({ toasts, queue }: Readonly<{ toasts: readonly Toast[]; queue: ToastQueue }>) {
  return (
    <div
      aria-label="Notifications"
      role="region"
      className="pointer-events-none fixed inset-x-0 top-7 z-[90] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} queue={queue} />
      ))}
    </div>
  );
}

export function ToastCard({ toast, queue }: Readonly<{ toast: Toast; queue: Pick<ToastQueue, "dismiss" | "pause" | "resume"> }>) {
  const pause = () => queue.pause(toast.id);
  const resume = () => queue.resume(toast.id);
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      data-toast={toast.tone}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="pointer-events-auto flex max-w-130 items-start gap-3 rounded-lg bg-text px-4.5 py-3 text-body-lg text-on-dark shadow-e3 motion-safe:pop-in"
    >
      <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm", ICON_TONE[toast.tone])}>
        <Icon icon={ICONS[toast.tone]} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{toast.title}</span>
        {toast.body ? <span className="text-body text-on-dark/80">{toast.body}</span> : null}
      </span>
      <ToastActions toast={toast} onDismiss={() => queue.dismiss(toast.id)} />
    </div>
  );
}

function ToastActions({ toast, onDismiss }: Readonly<{ toast: Toast; onDismiss: () => void }>) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            onDismiss();
          }}
          className="h-8 rounded-sm px-3 text-small font-semibold text-on-dark underline-offset-2 hover:bg-on-dark/10"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="grid size-8 place-items-center rounded-sm text-on-dark/80 hover:bg-on-dark/10 hover:text-on-dark"
      >
        <Icon icon={X} size={16} />
      </button>
    </span>
  );
}

export type { ToastInput, ToastTone };
