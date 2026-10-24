import type { Finding } from "@/lib/guardrails";

const SEVERITY: Readonly<Record<Finding["severity"], string>> = { blocker: "Must fix", warning: "Warning" };

export const NOT_CHECKED_YET =
  "Not looked at here yet: where names and numbers sit (it needs the piece mapper), and the drawn pixels of rotated art (a turned box is used). Colour limits are an estimate, not your print house's profile.";

/** The guardrails' findings for the panel as it is on the canvas, updated while an object moves. */
export function ChecksList({ findings }: Readonly<{ findings: readonly Finding[] }>) {
  return (
    <section aria-labelledby="checks-heading" data-testid="checks-list" className="flex flex-col gap-2">
      <h2 id="checks-heading" className="text-base font-medium text-ink">
        Checks
      </h2>
      {findings.length === 0 ? (
        <p className="text-sm text-muted">The checks that run today found nothing on this panel.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {findings.map((finding, at) => (
            <li key={`${finding.code}-${finding.itemId ?? "none"}-${at}`} className="rounded-lg border border-white/15 p-3 text-sm">
              <p className="font-medium text-ink">
                {SEVERITY[finding.severity]}: {finding.message}
              </p>
              <p className="mt-1 text-muted">{finding.fix}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{NOT_CHECKED_YET}</p>
    </section>
  );
}
