import { Notice } from "@/components/ui/Notice";
import type { Issue } from "./types";

/** What to look at in a team list. Problems that stop a release come first, then things to know. */
export function IssueList({ issues }: Readonly<{ issues: readonly Issue[] }>) {
  if (issues.length === 0) return null;
  const problems = issues.filter((i) => i.severity === "error");
  const notes = issues.filter((i) => i.severity === "warning");
  return (
    <div className="flex flex-col gap-2" data-testid="roster-issues">
      {problems.length > 0 ? (
        <Notice tone="warn" role="alert">
          <p className="font-medium">{problems.length === 1 ? "1 thing to fix" : `${problems.length} things to fix`}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((i) => (
              <li key={`${i.row}-${i.message}`}>{i.row > 0 ? `Row ${i.row}: ` : ""}{i.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {notes.length > 0 ? (
        <Notice tone="info">
          <ul className="list-disc pl-5">
            {notes.map((i) => (
              <li key={`${i.row}-${i.message}`}>{i.row > 0 ? `Row ${i.row}: ` : ""}{i.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}
