import { z } from "zod";
import type { SettingDef } from "@/lib/settings/types";
import { PATTERN_PRICE_KEY, PATTERN_TURNAROUND_KEY } from "./keys";

const wholeNumber = (min: number, max: number) =>
  z.number({ error: "Give a number." }).int("Whole numbers only.").min(min, `Use ${min} or more.`).max(max, `Use ${max} or less.`).nullable();

/**
 * The pattern service's two settings, registered through lib/settings/extensions.ts (decision 0056). Both start as "not set":
 * the spec gives no price, and the owner has not agreed a turnaround with the Sialkot team. They sit in existing groups because
 * the registry's list of groups is not this workstream's file. The questions point at the nearest questionnaire items.
 */
export const PATTERN_SERVICE_SETTINGS: readonly SettingDef[] = [
  {
    key: PATTERN_PRICE_KEY,
    group: "credits",
    label: "Pattern service: credits per request",
    help: "What a brand pays to send a design to the Sialkot team for a pattern. Leave empty while no price is agreed: nothing is charged and the brand is told Knitwright will confirm the price.",
    question: 1,
    input: "optionalNumber",
    schema: wholeNumber(0, 100_000),
    fallback: null,
  },
  {
    key: PATTERN_TURNAROUND_KEY,
    group: "ops",
    label: "Pattern service: working days to deliver",
    help: "Working days from accepting a request to returning the files. Leave empty while none is agreed: no turnaround is promised.",
    question: 11,
    input: "optionalNumber",
    schema: wholeNumber(1, 365),
    fallback: null,
  },
];
