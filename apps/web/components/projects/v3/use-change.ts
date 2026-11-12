"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Result } from "@/lib/server/core/errors";

/**
 * Runs one of the Projects page's actions from a menu or a dialog: the page is read again when it
 * worked, and the person is told in a toast when it did not, with the sentence the server gave.
 */
export function useChange() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const run = (action: (input: unknown) => Promise<Result<unknown>>, input: unknown, done: string, after?: () => void) =>
    start(async () => {
      const result = await action(input);
      if (!result.success) {
        toast.show({ tone: "error", title: "That did not work", body: result.error.message });
        return;
      }
      toast.show({ tone: "success", title: done });
      after?.();
      router.refresh();
    });

  return { run, pending };
}
