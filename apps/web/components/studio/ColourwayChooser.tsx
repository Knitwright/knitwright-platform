"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";
import type { ColourwayChoice } from "@/lib/projects/colour-controls";

/** Chooses which colourway the drawing and the colour fields show. Only offered when there is more than one. */
export function ColourwayChooser({ choices }: Readonly<{ choices: readonly ColourwayChoice[] }>) {
  const id = useId();
  const router = useRouter();
  const path = usePathname();
  if (choices.length < 2) return null;
  return (
    <div className="mb-4 flex flex-col gap-1.5 sm:max-w-xs">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Colourway shown
      </label>
      <select
        id={id}
        value={choices.find((choice) => choice.selected)?.id}
        onChange={(event) => router.replace(`${path}?colourway=${encodeURIComponent(event.target.value)}` as Route)}
        className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink"
      >
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </div>
  );
}
