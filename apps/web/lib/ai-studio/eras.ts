/**
 * The eras of Retro kit remix (`09`: 70s / 80s / 90s / 00s). Kept apart from `remix.ts` so the form in
 * the browser imports four words, not the garment rules.
 */
export const ERAS = ["70s", "80s", "90s", "00s"] as const;
export type Era = (typeof ERAS)[number];

export const ERA_LABELS: Readonly<Record<Era, string>> = { "70s": "70s", "80s": "80s", "90s": "90s", "00s": "00s" };

export const isEra = (value: unknown): value is Era => typeof value === "string" && (ERAS as readonly string[]).includes(value);
