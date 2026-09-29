"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** The one-sentence problem at the top of a form. Announced, and able to take focus. */
export function FormSummary({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      data-form-summary
      className="rounded-lg bg-warn-wash px-4 py-3 text-sm leading-relaxed text-warn"
    >
      {message}
    </div>
  );
}

/**
 * Shown in place of a form once it has done its work. It takes focus when it appears,
 * so a screen reader reads it instead of being left where the form used to be.
 */
export function FormDone({ children }: Readonly<{ children: ReactNode }>) {
  const message = useRef<HTMLDivElement>(null);
  // Once, when it appears. Drawing the form again must not take focus back.
  useEffect(() => message.current?.focus(), []);

  return (
    <div
      role="status"
      tabIndex={-1}
      ref={message}
      className="rounded-lg bg-ok-wash px-4 py-3 text-sm leading-relaxed text-ok"
    >
      {children}
    </div>
  );
}
