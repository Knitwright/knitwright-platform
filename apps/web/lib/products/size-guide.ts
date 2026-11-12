import type { SizeChart } from "@/lib/home/article-view";

/**
 * The size guide with its cm / in toggle (09 screen 11, v3.5). The article holds every measurement in millimetres
 * (decision 0066); the guide shows them in centimetres to one decimal or in inches to one decimal, converted here
 * and nowhere else. A size with no value stays empty, never zero.
 */

export const UNITS = ["cm", "in"] as const;
export type GuideUnit = (typeof UNITS)[number];

const MM_PER: Readonly<Record<GuideUnit, number>> = { cm: 10, in: 25.4 };

/** 520 mm as "52" cm or "20.5" in. */
export function fromMm(mm: number, unit: GuideUnit): string {
  const value = Math.round((mm / MM_PER[unit]) * 10) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export interface GuideRow {
  readonly label: string;
  readonly cells: readonly (string | null)[];
  readonly ruleId: string;
}

export interface SizeGuide {
  readonly sizes: readonly string[];
  readonly rows: readonly GuideRow[];
  readonly empty: string | null;
}

export function sizeGuide(chart: SizeChart, unit: GuideUnit): SizeGuide {
  return {
    sizes: chart.sizes,
    rows: chart.rows.map((row) => ({
      label: `${row.letter} ${row.description}`,
      cells: row.values.map((value) => (value === null ? null : fromMm(value, unit))),
      ruleId: row.ruleId,
    })),
    empty: chart.empty,
  };
}
