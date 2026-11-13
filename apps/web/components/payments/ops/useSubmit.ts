"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Reply = Readonly<{ success: true } | { success: false; error: Readonly<{ message: string }> }>;

/**
 * One small form on the ops finance page: read the form, call the action, say what happened, refresh the figures.
 * `read` answers the action's input, or a sentence saying what to fix.
 */
export function useSubmit<T>(read: (form: FormData) => T | string, act: (input: T) => Promise<Reply>, done: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = read(new FormData(event.currentTarget));
    if (typeof input === "string") return setNote({ tone: "warn", text: input });
    start(async () => {
      const reply = await act(input).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "Not sent. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: done });
      router.refresh();
    });
  };

  return { pending, note, onSubmit };
}

export const text = (form: FormData, name: string): string => String(form.get(name) ?? "").trim();
