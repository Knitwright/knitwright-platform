import { z } from "zod";
import type { SettingDef } from "@/lib/settings/types";

/**
 * The factory model's settings (decision 0071), registered through lib/settings/extensions.ts so a platform admin
 * sets them at /admin/settings with a history. The Class A cut-off is read on the factory's own clock (its time zone
 * is a column of `factories`), so Monday 12:00 means 12:00 in Sialkot. QC days start "not set": nobody has agreed
 * one. Keys start with "production." so the settings console does not write them through to the old factory profile.
 */

export const CUTOFF_WEEKDAY_KEY = "production.class_a_cutoff_weekday";
export const CUTOFF_MINUTES_KEY = "production.class_a_cutoff_minutes";
export const QC_DAYS_KEY = "production.qc_days";

const wholeNumber = (min: number, max: number) =>
  z.number({ error: "Give a number." }).int("Whole numbers only.").min(min, `Use ${min} or more.`).max(max, `Use ${max} or less.`);

/** Monday 12:00 on the factory's clock (spec F-O1), a placeholder until the factory agrees it. */
export const DEFAULT_CUTOFF = { weekday: 1, minutes: 12 * 60 } as const;

export const FACTORY_SETTINGS: readonly SettingDef[] = [
  {
    key: CUTOFF_WEEKDAY_KEY,
    group: "factory",
    label: "Class A weekly cut-off: day",
    help: "The day the weekly Class A print slot closes, on the factory's own clock. Knitwright placeholder: Monday.",
    question: 6,
    input: "weekday",
    schema: wholeNumber(0, 6),
    fallback: DEFAULT_CUTOFF.weekday,
  },
  {
    key: CUTOFF_MINUTES_KEY,
    group: "factory",
    label: "Class A weekly cut-off: time (factory's own clock)",
    help: "Hours and minutes on the factory's clock, not UTC: 12:00 is noon in Sialkot. Knitwright placeholder: 12:00.",
    question: 6,
    input: "time",
    schema: wholeNumber(0, 1439),
    fallback: DEFAULT_CUTOFF.minutes,
  },
  {
    key: QC_DAYS_KEY,
    group: "factory",
    label: "Working days for QC and packing",
    help: "Working days from ready for QC to handed to the carrier. Leave empty while none is agreed: no delivery date is promised.",
    question: 5,
    input: "optionalNumber",
    schema: wholeNumber(0, 60).nullable(),
    fallback: null,
  },
];
