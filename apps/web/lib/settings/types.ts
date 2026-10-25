import type { z } from "zod";

/** How the console asks for a value. */
export type InputKind = "number" | "optionalNumber" | "weekday" | "time" | "lines" | "list";

export interface SettingDef {
  /** Dotted, lower case: group.name. */
  readonly key: string;
  readonly group: string;
  readonly label: string;
  readonly help: string;
  /** The question in docs/owner/questionnaire-2026-10-25.md this setting answers. */
  readonly question: number;
  readonly input: InputKind;
  /** For input "lines": what each "left = right" line means. */
  readonly lines?: "ladder" | "numbers" | "text";
  readonly schema: z.ZodType;
  /** The value used while nothing is stored (the in-code placeholder). */
  readonly fallback: unknown;
}

export interface StoredSetting {
  readonly value: unknown;
  readonly setBy: string | null;
  /** ISO timestamp. */
  readonly setAt: string;
}

export type StoredSettings = Readonly<Record<string, StoredSetting>>;
