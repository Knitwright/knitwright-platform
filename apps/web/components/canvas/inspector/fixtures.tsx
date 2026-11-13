"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GarmentInspectorView } from "@/lib/inspector/types";

/**
 * FIXTURE ONLY: garment inspector views handed in by `/dev/inspector`, by design id, so the inspector
 * draws with no session and no database for the 1440 × 900 comparison with e15–e26 and e41. A real
 * canvas never mounts this provider, and without it the inspector reads through its action.
 */

export type InspectorFixture = Readonly<{
  garments: Readonly<Record<string, GarmentInspectorView>>;
  /** Open the Product info modal at once (e41). */
  openInfo?: boolean;
  /** Show this layer of the garment instead of the garment (e22, e23, e25). */
  elementId?: string;
}>;

const FixtureContext = createContext<InspectorFixture | null>(null);

export function InspectorFixtures({ value, children }: Readonly<{ value: InspectorFixture; children: ReactNode }>) {
  return <FixtureContext.Provider value={value}>{children}</FixtureContext.Provider>;
}

export const useInspectorFixture = (): InspectorFixture | null => useContext(FixtureContext);
