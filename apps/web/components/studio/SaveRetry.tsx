"use client";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Retry } from "@/lib/projects/editor-state";

type SaveRetryProps = Readonly<{ retry: Retry | null; onRetry: () => void }>;

/** A save that failed on our side or never reached the server: what went wrong, and a way to try again. */
export function SaveRetry({ retry, onRetry }: SaveRetryProps) {
  if (!retry) return null;
  return (
    <Notice tone="warn" role="alert">
      <p className="font-medium">Your last change was not saved.</p>
      <p className="mt-1">{retry.message}</p>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Notice>
  );
}
