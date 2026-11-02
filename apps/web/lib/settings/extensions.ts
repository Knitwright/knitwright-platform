import { z } from "zod";
import { FACTORY_SETTINGS } from "@/lib/factory/settings";
import { VIDEO_SETTINGS } from "@/lib/media/video/model-settings";
import { OPS_INSPECTION_SETTINGS } from "@/lib/ops/inspection/settings";
import { PATTERN_SERVICE_SETTINGS } from "@/lib/pattern-service/settings";
import { SHOOT_SETTINGS } from "@/lib/shoots/settings";
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
  // Plan v5 X6 (decision 0071): the Class A cut-off on the factory's clock, and QC days.
  ...FACTORY_SETTINGS,
  // Plan v5 L5 (decision 0095): the AI video board's model list, its credits a second, which models
  // hold a commercial licence, and how many frames of a clip the checker samples. No key or secret.
  ...VIDEO_SETTINGS,
  // Plan v5 O1 (decision 0100): the run size above which a third-party inspection is offered (F-O3).
  ...OPS_INSPECTION_SETTINGS,
  // Plan v5 L3 (decision 0093): the licence reference behind each AI model preset, and who holds it.
  // Empty until somebody has read the terms, which means no likeness can be generated. No secret.
  ...SHOOT_SETTINGS,
];
