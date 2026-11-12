"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FilterChip } from "@/components/ui/Chips";
import { CREATION_FILTERS, FILTER_LABELS, type CreationFilter } from "@/lib/projects-page/creations";
import { AI_PATH } from "@/lib/projects-page/paths";

/** The chips over AI Creations (d06): All, Scenes, Lifestyle, Garment-locked. */
export function CreationFilters({ current }: Readonly<{ current: CreationFilter }>) {
  const router = useRouter();
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-2">
      {CREATION_FILTERS.map((filter) => (
        <FilterChip
          key={filter}
          label={FILTER_LABELS[filter]}
          selected={filter === current}
          className="h-9 px-4 text-body"
          onClick={() => router.push((filter === "all" ? AI_PATH : `${AI_PATH}?show=${filter}`) as Route)}
        />
      ))}
    </div>
  );
}
