"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type NewLinkBoxProps = Readonly<{ address: string; label: string; testId: string; children: React.ReactNode }>;

/**
 * A link that has just been made, shown once (plan v5 Z7, decision 0087). Only its hash is kept, as
 * a share link's is (decision 0026), so it cannot be shown again: the club copies it now and sends
 * it themselves. Knitwright emails nobody unless a provider is set up.
 */
export function NewLinkBox({ address, label, testId, children }: NewLinkBoxProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-ok-wash px-4 py-3 text-sm text-ok">
      <p>{children}</p>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={address}
          aria-label={label}
          data-testid={testId}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-3 font-mono text-[13px] text-ink"
        />
        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
