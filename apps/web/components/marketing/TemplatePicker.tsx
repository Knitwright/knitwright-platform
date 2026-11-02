"use client";

import { useId, useMemo, useState } from "react";
import {
  GROUP_LABELS,
  MARKETING_FORMAT_LABELS,
  MARKETING_GROUPS,
  buildMarketingTemplates,
  type MarketingGroup,
  type MarketingTemplate,
} from "@/lib/marketing";
import { PANEL_CHIP, PANEL_FIELD } from "./PanelFrame";

/**
 * THE FIFTY MARKETING TEMPLATES, AS A PICKER (spec F-L2 "1. Templates in the editor"; plan v5 L4,
 * decision 0094).
 *
 * Grouped as `07` groups them, with a search and the format on every card, because a person picks a
 * post at a size. The list is built by the same code the 50 rows were seeded from, so the picker and
 * the library cannot disagree; when the shell carries the rows, it passes them in instead.
 */

type Props = Readonly<{
  /** The rows, when they have been read. Without them the picker builds the same list itself. */
  templates?: readonly MarketingTemplate[];
  current: string | null;
  busy: boolean;
  onPick: (template: MarketingTemplate) => void;
}>;

export function TemplatePicker({ templates, current, busy, onPick }: Props) {
  const ids = { search: useId(), group: useId() };
  const all = useMemo(() => templates ?? buildMarketingTemplates(), [templates]);
  const [words, setWords] = useState("");
  const [group, setGroup] = useState<MarketingGroup | "">("");

  const shown = all.filter((one) => {
    const matchesGroup = group === "" || one.group === group;
    const needle = words.trim().toLowerCase();
    return matchesGroup && (needle === "" || one.title.toLowerCase().includes(needle) || one.lead.toLowerCase().includes(needle));
  });

  return (
    <section aria-label="Marketing templates" data-testid="marketing-templates" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[13px] font-medium text-ink">Layouts</h3>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={ids.search} className="text-[13px] font-medium text-ink">
            Search
          </label>
          <input id={ids.search} type="search" value={words} disabled={busy} className={PANEL_FIELD} onChange={(event) => setWords(event.target.value)} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={ids.group} className="text-[13px] font-medium text-ink">
            Group
          </label>
          <select id={ids.group} value={group} disabled={busy} className={PANEL_FIELD} onChange={(event) => setGroup(event.target.value as MarketingGroup | "")}>
            <option value="">All {all.length}</option>
            {MARKETING_GROUPS.map((one) => (
              <option key={one} value={one}>
                {GROUP_LABELS[one]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-tile-2/90 p-4 text-[13px] leading-relaxed text-ink-2">
          No layout matches that. Clear the search, or choose another group.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((template) => (
            <li key={template.slug}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={current === template.slug}
                onClick={() => onPick(template)}
                className={`${PANEL_CHIP} h-auto w-full flex-col items-start gap-1 rounded-2xl py-2 text-left`}
                data-testid={`marketing-template-${template.slug}`}
              >
                <span className="text-[13px] text-ink">{template.title}</span>
                <span className="text-[12px] leading-relaxed text-ink-2">{template.lead}</span>
                <span className="font-mono text-[11px] text-ink-2">
                  {GROUP_LABELS[template.group]} · {MARKETING_FORMAT_LABELS[template.format]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] leading-relaxed text-ink-2">Every layout is a Knitwright starter. Nobody has reviewed them.</p>
    </section>
  );
}
