import { z } from "zod";
import { PATTERN_SERVICE_SETTINGS } from "@/lib/pattern-service/settings";
import type { SettingDef } from "./types";

/**
 * The registration point for settings other workstreams own. W3-C (lib/media-check) adds its checker thresholds
 * here, as entries in group "checker" with keys such as `checker.colour_delta_max`. Add entries; do not edit
 * registry.ts. Never register a secret.
 */
export const EXTENSION_SETTINGS: readonly SettingDef[] = [
  {
    key: "designer.royalty_per_unit",
    group: "designers",
    label: "Designer royalty per unit (smallest currency unit)",
    help: "Credited to a designer for each piece ordered from their template, in the smallest unit of the order's currency (cents for AUD). Leave empty while no rate is agreed: nothing accrues, and units are still counted. Nothing is paid out from the platform.",
    question: 42,
    input: "optionalNumber",
    schema: z.number({ error: "Give a number." }).int("Whole numbers only.").min(0, "Use 0 or more.").max(1_000_000, "Use 1000000 or less.").nullable(),
    fallback: null,
  },
  ...PATTERN_SERVICE_SETTINGS,
];
