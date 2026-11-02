"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  SEEDED_EXPORT_TARGETS,
  SEEDED_WATERMARK_RULES,
  type BrandVoice,
  type CmykProfile,
  type ExportTarget,
  type WatermarkRule,
} from "@/lib/marketing";
import type { WriteRequest, WriteResult } from "@/lib/marketing/copy/write";

/**
 * WHAT A PANEL CANNOT BE HANDED BY THE SHELL (plan v5 L4, decision 0094).
 *
 * `LaunchPanelProps` is the whole contract: the project, the selection and the eighteen commands.
 * It carries no brand, no repeat prints, no files, and no way to reach a model -- and the contract
 * is explicit that "a panel never fetches". So the few things a marketing panel needs from outside
 * the canvas arrive here, through one provider the wiring step fills in.
 *
 * Every one has an honest default:
 *
 *   * **no writer**: "Write for me" says it is not connected yet rather than pretending;
 *   * **no repeat prints and no pictures**: the panels show their empty states;
 *   * **the seeded export targets and watermark rules**: `SEEDED_EXPORT_TARGETS` and
 *     `SEEDED_WATERMARK_RULES`, which a test holds to the migration's own rows, so the panel offers
 *     what the database holds even before the rows are read;
 *   * **the free plan**, which is the plan that carries the watermark, so nothing is promised
 *     without a mark on it.
 */

/** A picture the platform drew, offered for a slot. A generated picture is not one of these. */
export interface OfferedAsset {
  readonly fileId: string;
  readonly label: string;
  readonly contentType: string;
  readonly provenance: "deterministic" | "golden_sample";
  /** A `data:` or storage address the panel can show as a thumbnail, or null. */
  readonly thumbnail: string | null;
}

/** A repeat print of this brand, from the repeat maker. */
export interface OfferedFill {
  readonly id: string;
  readonly label: string;
  readonly thumbnail: string | null;
}

export interface MarketingServices {
  /** Runs "Write for me", metered, on the server. Null while nothing is wired to it. */
  readonly writer: ((request: WriteRequest) => Promise<WriteResult>) | null;
  readonly voice: BrandVoice | null;
  readonly pictures: readonly OfferedAsset[];
  readonly fills: readonly OfferedFill[];
  readonly targets: readonly ExportTarget[];
  readonly watermarkRules: readonly WatermarkRule[];
  readonly plan: WatermarkRule["plan"];
  /** The colour profile a CMYK export is separated against. None is on file today. */
  readonly cmykProfile: CmykProfile | null;
  /** Starts an export. Null while nothing is wired to it, which the panel says. */
  readonly onExport: ((request: Readonly<{ boardIds: readonly string[]; targetKey: string }>) => void) | null;
}

export const DEFAULT_SERVICES: MarketingServices = {
  writer: null,
  voice: null,
  pictures: [],
  fills: [],
  targets: SEEDED_EXPORT_TARGETS,
  watermarkRules: SEEDED_WATERMARK_RULES,
  plan: "free",
  cmykProfile: null,
  onExport: null,
};

const ServicesContext = createContext<MarketingServices>(DEFAULT_SERVICES);

export const useMarketingServices = (): MarketingServices => useContext(ServicesContext);

export function MarketingServicesProvider({ services, children }: Readonly<{ services: Partial<MarketingServices>; children: ReactNode }>) {
  return <ServicesContext.Provider value={{ ...DEFAULT_SERVICES, ...services }}>{children}</ServicesContext.Provider>;
}

/** Said where a panel needs something the shell has not been wired to yet. */
export const NOT_WIRED = "This is not connected yet, so nothing has been sent.";
