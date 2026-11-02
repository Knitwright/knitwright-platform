import type { ImportItem } from "@/lib/brand-studio/import/types";
import type { ItemGroup } from "@/lib/brand-studio/import/view";

/**
 * One group of what an import found, and a row per item with its own two buttons (decision 0102
 * item 10, built by decision 0106).
 *
 * **Per item, never all or nothing.** Every row starts `pending` and carries Keep and Leave out,
 * and a group that found nothing shows the real empty state the view model holds -- which always
 * names the one action that fills it, such as "Add one from your uploads instead".
 *
 * A row that carries a note shows it with the rule behind it. Four of those rules are `R-GAP-000`,
 * because the rulebook has no entry for a printable gamut, for which fonts the platform may use,
 * for whether an address belongs to the brand that pasted it, or for how a visual style may be
 * written from a brand's own pictures.
 */

const CARD = "flex flex-col gap-2 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3";

const BUTTON =
  "chip-btn inline-flex min-h-10 items-center justify-center rounded-full border px-3.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft disabled:cursor-not-allowed disabled:opacity-55";

type Props = Readonly<{
  group: ItemGroup;
  labels: Readonly<{ accepted: string; rejected: string }>;
  busy: boolean;
  onDecide: (id: string, decision: "accepted" | "rejected") => void;
  onKeepAll: () => void;
}>;

export function ImportGroup({ group, labels, busy, onDecide, onKeepAll }: Props) {
  const headingId = `import-group-${group.kind}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2" data-testid={headingId}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-[15px] font-medium text-ink">
          {group.heading}
        </h3>
        {group.keepAll === null ? null : (
          <button type="button" disabled={busy} onClick={onKeepAll} className={`${BUTTON} border-white/20 text-ink`} data-testid={`import-keep-all-${group.kind}`}>
            {group.keepAll}
          </button>
        )}
      </header>

      {group.empty === null ? null : (
        <p className="rounded-2xl border border-dashed border-white/20 px-4 py-3 text-[13px] leading-relaxed text-ink-2" data-testid={`import-empty-${group.kind}`}>
          {group.empty}
        </p>
      )}

      {group.rows.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {group.rows.map((row) => (
            <li key={row.id}>
              <ImportRow row={row} labels={labels} busy={busy} onDecide={onDecide} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type RowProps = Readonly<{
  row: ImportItem;
  labels: Readonly<{ accepted: string; rejected: string }>;
  busy: boolean;
  onDecide: (id: string, decision: "accepted" | "rejected") => void;
}>;

/** What the row's own state is, in words. Nothing is said by a colour alone. */
const SAID: Readonly<Record<ImportItem["decision"], string>> = {
  pending: "Not decided yet",
  accepted: "Keeping",
  rejected: "Left out",
};

function ImportRow({ row, labels, busy, onDecide }: RowProps) {
  return (
    <div className={CARD} data-testid={`import-item-${row.id}`}>
      <p className="text-[15px] text-ink">{row.label}</p>
      <p className="text-[13px] leading-relaxed text-ink-2">{row.detail}</p>
      {row.notes.map((note) => (
        <p key={`${note.ruleId}-${note.message}`} className="text-[13px] leading-relaxed text-ink-2">
          {note.message} <span className="font-mono">{note.ruleId}</span>
        </p>
      ))}
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-2" data-testid={`import-said-${row.id}`}>
        {SAID[row.decision]}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.decision === "accepted"}
          onClick={() => onDecide(row.id, "accepted")}
          className={`${BUTTON} ${row.decision === "accepted" ? "border-ok/50 text-ink" : "border-white/20 text-ink"}`}
          data-testid={`import-keep-${row.id}`}
        >
          {labels.accepted}
          <span className="sr-only">: {row.label}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.decision === "rejected"}
          onClick={() => onDecide(row.id, "rejected")}
          className={`${BUTTON} ${row.decision === "rejected" ? "border-warn/50 text-ink" : "border-white/20 text-ink"}`}
          data-testid={`import-leave-${row.id}`}
        >
          {labels.rejected}
          <span className="sr-only">: {row.label}</span>
        </button>
      </div>
    </div>
  );
}
