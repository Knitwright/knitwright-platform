import type { Progress, StageLine } from "@/lib/brand-studio/import/view";

/**
 * The six stage lines of a brand import, and the progress line above them (decision 0102 item 10,
 * built by decision 0108).
 *
 * All six are drawn from the start, so a person watching a minute of work can see what is coming
 * and what is left, and no stage ever sits without a word beside it. **The state is said in words,
 * never only in a colour**: each line carries its own "Waiting", "Working", "Done", "Nothing
 * found", "Left out" or "Could not be done", which `lib/brand-studio/import/view.ts` works out.
 *
 * The list is a live region, so a minute of work is announced rather than only animated.
 */

const STATE_PILL = "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider";

/**
 * The border of one state. The word beside it is what says the state; this only helps somebody who
 * can see it find the line faster.
 */
const TONES: Readonly<Record<StageLine["status"], string>> = {
  pending: "border-white/15 text-ink-2",
  running: "border-cobalt-soft/50 text-ink",
  done: "border-ok/40 text-ok",
  empty: "border-white/15 text-ink-2",
  skipped: "border-white/15 text-ink-2",
  failed: "border-warn/40 text-warn",
};

type Props = Readonly<{ stages: readonly StageLine[]; progress: Progress }>;

export function ImportStages({ stages, progress }: Props) {
  return (
    <section aria-labelledby="import-stages-heading" className="flex flex-col gap-3" data-testid="import-stages">
      <h3 id="import-stages-heading" className="text-[15px] font-medium text-ink">
        {progress.summary}
      </h3>
      <div
        aria-hidden="true"
        className="h-1.5 w-full overflow-hidden rounded-full border border-white/12 bg-white/[0.04]"
      >
        <span className="block h-full rounded-full bg-cobalt-soft" style={{ width: `${progress.percent}%` }} />
      </div>
      <ol aria-live="polite" aria-busy={progress.running} className="flex flex-col gap-2">
        {stages.map((stage) => (
          <li key={stage.stage} className="flex min-w-0 items-start justify-between gap-3" data-testid={`import-stage-${stage.stage}`}>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[14px] text-ink">{stage.label}</span>
              <span className="text-[13px] leading-relaxed text-ink-2">{stage.words}</span>
            </span>
            <span className={`${STATE_PILL} ${TONES[stage.status]}`}>{stage.said}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
