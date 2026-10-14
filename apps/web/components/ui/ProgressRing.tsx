import { useId } from "react";

type ProgressRingProps = Readonly<{
  /** Whole percent, from 0 to 100. */
  percent: number;
  /** What the ring means, for screen readers, such as "78 percent of the file is settled". */
  label: string;
  size?: number;
}>;

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring drawn in the thread colours, filled to a percentage. */
export function ProgressRing({ percent, label, size = 64 }: ProgressRingProps) {
  const gradient = `${useId()}-thread`;
  const share = Math.min(100, Math.max(0, percent)) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={label} className="shrink-0">
      <defs>
        <linearGradient id={gradient} x1="0" x2="1">
          <stop offset="0" stopColor="#b9c4ff" />
          <stop offset=".5" stopColor="#ffd3e6" />
          <stop offset="1" stopColor="#c7f0e4" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--tile-2)" strokeWidth="4" />
      {share > 0 ? (
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(share * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
          transform="rotate(-90 18 18)"
          className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-1000"
        />
      ) : null}
    </svg>
  );
}
