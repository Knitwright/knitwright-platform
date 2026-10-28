import { DEFAULT_LABEL } from "@/lib/production/contract";
import type { GuardrailSettings } from "./types";

/**
 * Settings the checks need to run. Every value here is Knitwright's own default and is labelled so
 * (owner questions: print house dpi and bleed, name and number clear space, league rules). None is a measurement.
 */
export const DEFAULT_SETTINGS: GuardrailSettings = {
  minDpi: { value: 150, source: "knitwright-default" },
  bleedMm: { value: 10, source: "knitwright-default" },
  safeZoneMm: { value: 10, source: "knitwright-default" },
};

export const sourceNote = (source: "print-house" | "knitwright-default"): string =>
  source === "print-house" ? "from your print house" : DEFAULT_LABEL;
