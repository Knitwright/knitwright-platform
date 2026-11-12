"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_GARMENT_UNIT, type GarmentUnit } from "@/lib/units/preference";

/**
 * The person's garment unit, handed down by the shell (decision 0144), so a measurement or size-guide
 * component opens in it. Outside the shell (a public page, a test) it is millimetres.
 */
const LengthUnitContext = createContext<GarmentUnit>(DEFAULT_GARMENT_UNIT);

export function LengthUnitProvider({ unit, children }: Readonly<{ unit: GarmentUnit; children: ReactNode }>) {
  return <LengthUnitContext.Provider value={unit}>{children}</LengthUnitContext.Provider>;
}

/** The unit a measurement view starts in. A view's own toggle can still change what it shows. */
export const usePreferredLengthUnit = (): GarmentUnit => useContext(LengthUnitContext);
