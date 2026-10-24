"use client";

import { useEffect, useState } from "react";
import { OUTPUT_LABELS, type OutputKind } from "@/lib/credits/kinds";

type Summary = Readonly<{ enforced: boolean; balance: number; prices: Readonly<Record<OutputKind, number>>; isPlaceholder: boolean }>;

const read = async (): Promise<Summary | null> => {
  try {
    const response = await fetch("/api/credits", { cache: "no-store" });
    const body = (await response.json()) as { success: boolean; data?: Summary };
    return body.success && body.data ? body.data : null;
  } catch {
    return null;
  }
};

/**
 * What a paid action costs and what is left, under its button. It shows nothing while credits are
 * not enforced (the default), so a screen without charging looks as it always did. The balance is
 * read again whenever the window is focused, which is after a download or a new tab.
 */
export function PriceNote({ kind }: Readonly<{ kind: OutputKind }>) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => void read().then((next) => live && setSummary(next));
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  if (!summary?.enforced) return null;
  const price = summary.prices[kind];
  return (
    <p className="text-[12px] leading-relaxed text-chalk-muted" data-testid={`price-${kind}`}>
      {OUTPUT_LABELS[kind]}: {price} {price === 1 ? "credit" : "credits"}, charged once for each saved version. You have {summary.balance}.
      {summary.isPlaceholder ? " The price is a placeholder." : ""}
    </p>
  );
}
