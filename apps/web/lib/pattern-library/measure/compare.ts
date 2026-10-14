import type { PatternMeasurement } from "@/lib/production/contract";

/** A figure some document states for a point of measure, in tenths of a millimetre. */
export type Target = Readonly<{
  pointId: string;
  label: string;
  tenthsMm: number;
  toleranceTenthsMm: number;
}>;

export type Comparison = Readonly<{
  pointId: string;
  targetTenthsMm: number;
  measuredTenthsMm: number | null;
  /** Measured minus stated; positive when the pattern is bigger than the document says. */
  differenceTenthsMm: number | null;
  within: boolean | null;
  sentence: string;
}>;

const cm = (tenths: number): string => (Math.abs(tenths) / 100).toFixed(1);

/**
 * Sets what a document says beside what the pattern measures. A figure the pattern cannot
 * give is reported as such. A difference over the tolerance reads "differs from the pattern by".
 */
export function compareToTargets(targets: readonly Target[], measurements: readonly PatternMeasurement[]): Comparison[] {
  return targets.map((target) => {
    const found = measurements.find((m) => m.pointId === target.pointId);
    if (!found) {
      return { pointId: target.pointId, targetTenthsMm: target.tenthsMm, measuredTenthsMm: null, differenceTenthsMm: null, within: null,
        sentence: `${target.label}: the document says ${cm(target.tenthsMm)} cm. The pattern does not give this measurement.` };
    }
    const difference = found.tenthsMm - target.tenthsMm;
    const within = Math.abs(difference) <= target.toleranceTenthsMm;
    const sentence = within
      ? `${target.label}: the document says ${cm(target.tenthsMm)} cm and the pattern measures ${cm(found.tenthsMm)} cm. The two agree within ${cm(target.toleranceTenthsMm)} cm.`
      : `${target.label}: the document says ${cm(target.tenthsMm)} cm and the pattern measures ${cm(found.tenthsMm)} cm. It differs from the pattern by ${cm(difference)} cm (allowed: ${cm(target.toleranceTenthsMm)} cm).`;
    return { pointId: target.pointId, targetTenthsMm: target.tenthsMm, measuredTenthsMm: found.tenthsMm, differenceTenthsMm: difference, within, sentence };
  });
}
