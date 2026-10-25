import { ProgressRing } from "@/components/ui/ProgressRing";
import type { Confirmable } from "@/lib/projects/tech-pack-confirm";
import { sectionSearch, thingsLeftSentence, type FileProgress } from "@/lib/projects/tech-pack-sections";
import { AcceptAllSuggestions } from "./AcceptAllSuggestions";

type SummaryProps = Readonly<{
  progress: FileProgress;
  /** How many things the sections still need, together. */
  left: number;
  baseSearch: string;
  confirmables: readonly Confirmable[];
}>;

/** Above the list of sections: how much of the file is settled, what is left, and accepting every suggestion. */
export function FileSummary({ progress, left, baseSearch, confirmables }: SummaryProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="file-summary">
      <div className="flex items-center gap-3.5">
        <ProgressRing percent={progress.percent} label={`${progress.percent} percent of the file is settled`} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[26px] font-medium tracking-tight text-ink" aria-hidden="true">{`${progress.percent}%`}</span>
          <a
            href={sectionSearch(baseSearch, "left")}
            data-file-section-link="left"
            className="inline-flex min-h-10 items-center text-xs text-cobalt-soft underline-offset-4 hover:underline"
            data-testid="things-left"
          >
            {thingsLeftSentence(left)}
          </a>
        </div>
      </div>
      <AcceptAllSuggestions items={confirmables} />
    </div>
  );
}
