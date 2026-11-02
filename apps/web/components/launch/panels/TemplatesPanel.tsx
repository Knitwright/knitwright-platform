"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { collectionProps, filterProps, listProps } from "@/components/mockups/a11y";
import {
  CLEAR_FILTERS,
  NO_MATCH_BODY,
  NO_MATCH_TITLE,
  OPENS_THE_EDITOR,
  OPEN_MOCKUPS,
  OTHER_KINDS,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_ALL,
  SHOW_FEWER,
  collectionsOf,
  type TagFilterGroup,
  type TemplateCollection,
  type TemplatesView,
} from "@/lib/launch-panels";
import type { LaunchPanelProps } from "@/lib/launch";
import { showAllTemplatesProps, templateFilterSuffix } from "./a11y";
import { CHIP, FIELD, PanelEmpty, PanelLoading, PanelProblem, PanelShell, SMALL_CHIP } from "./frame";
import { TemplateCardRow } from "./TemplateCardRow";
import { useJson } from "./useJson";

/**
 * THE TEMPLATE LIBRARY IN THE LAUNCH RAIL (spec Launch shell, "Templates"; plan v5, decision 0106).
 *
 * L1's contract named workstream L8 for this panel, and L8 was given `lib/templates/**` and no
 * component path at all: its own record says `components/templates/**` "belong to no wave-4
 * workstream" and leaves `matchesTags`, `matchesSearch`, `TAG_CHOICES` and `gapForType` "ready for
 * the panel that shows them". This is that panel, and it uses those four rather than a second
 * filter -- on the server, because they reach zod and a client component may not
 * (`tests/architecture/client-weight.test.ts`).
 *
 * It takes `LaunchPanelProps` and nothing else, so the shell can mount it wherever the rail's
 * `templates` panel goes. The one thing it does is already a command the platform offers: a design
 * template becomes a new design in the brand, which opens in the editor. It is **not** laid onto
 * this canvas, because a launch canvas launches a design that already exists, and the panel says so
 * rather than leaving a person to find out.
 */

/** How long to wait after the last keystroke before asking the server. */
const SETTLE_MS = 250;

const addressOf = (text: string, tags: Readonly<Record<string, string>>): string => {
  const query = new URLSearchParams();
  if (text !== "") query.set("q", text);
  for (const [group, value] of Object.entries(tags)) query.set(group, value);
  const asked = query.toString();
  return asked === "" ? "/api/launch/templates" : `/api/launch/templates?${asked}`;
};

export default function TemplatesPanel({ context, commands }: LaunchPanelProps) {
  const ids = { heading: useId(), search: useId() };
  const [typed, setTyped] = useState("");
  const [settled, setSettled] = useState("");
  const [tags, setTags] = useState<Readonly<Record<string, string>>>({});
  const [expanded, setExpanded] = useState<readonly string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(typed), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // `last` is the previous answer, kept while the next one is in flight, so typing in the search
  // box never empties the panel and the filter chips never flicker away under the cursor.
  const { state, last, reload } = useJson<TemplatesView>(addressOf(settled, tags));
  const view = state.kind === "ready" ? state.value : last;
  const collections = useMemo(() => (view === null ? [] : collectionsOf(view.cards, expanded)), [view, expanded]);
  const toggle = (key: string) => setExpanded((open) => (open.includes(key) ? open.filter((one) => one !== key) : [...open, key]));
  const choose = (group: string, id: string) =>
    setTags((was) => (was[group] === id ? Object.fromEntries(Object.entries(was).filter(([name]) => name !== group)) : { ...was, [group]: id }));
  const clear = () => {
    setTags({});
    setTyped("");
  };

  return (
    <PanelShell id="templates" headingId={ids.heading} busy={context.busy}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.search} className="text-[12px] text-ink-2">
          {SEARCH_LABEL}
        </label>
        <input
          id={ids.search}
          type="search"
          value={typed}
          placeholder={SEARCH_PLACEHOLDER}
          onChange={(event) => setTyped(event.target.value)}
          className={FIELD}
          data-testid="launch-templates-search"
        />
      </div>

      {view?.filters.map((group) => (
        <FilterRow key={group.group} group={group} chosen={tags[group.group] ?? null} onChoose={(id) => choose(group.group, id)} />
      ))}

      {state.kind === "loading" ? <PanelLoading id="templates" /> : null}
      {state.kind === "failed" ? <PanelProblem id="templates" onRetry={reload} /> : null}

      {view !== null && view.total === 0 && state.kind === "ready" ? <PanelEmpty id="templates" /> : null}

      {view !== null && view.total > 0 && view.cards.length === 0 ? (
        <div className="flex flex-col items-start gap-2" data-testid="launch-templates-no-match">
          <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-white/20 p-4">
            <h3 className="text-[14px] font-medium text-ink">{NO_MATCH_TITLE}</h3>
            <p className="text-[13px] leading-relaxed text-ink-2">{NO_MATCH_BODY}</p>
          </div>
          <button type="button" onClick={clear} className={CHIP} data-testid="launch-templates-clear">
            {CLEAR_FILTERS}
          </button>
        </div>
      ) : null}

      {collections.map((collection) => (
        <Collection
          key={collection.key}
          collection={collection}
          open={expanded.includes(collection.key)}
          busy={context.busy}
          onToggle={() => toggle(collection.key)}
        />
      ))}

      <footer className="flex flex-col items-start gap-1.5 border-t border-white/10 pt-2">
        <p className="text-[12px] leading-relaxed text-ink-2">{OPENS_THE_EDITOR}</p>
        <p className="text-[12px] leading-relaxed text-ink-2">{OTHER_KINDS}</p>
        <button type="button" onClick={() => commands.openPanel("mockups")} className={CHIP} data-testid="launch-templates-open-mockups">
          {OPEN_MOCKUPS}
        </button>
      </footer>
    </PanelShell>
  );
}

type FilterRowProps = Readonly<{ group: TagFilterGroup; chosen: string | null; onChoose: (id: string) => void }>;

export function FilterRow({ group, chosen, onChoose }: FilterRowProps) {
  return (
    <ul {...listProps(`${group.label} filters`)} className="flex flex-wrap gap-1.5" data-testid={`launch-templates-filter-${group.group}`}>
      {group.choices.map((choice) => (
        <li key={choice.id} role="listitem">
          <button
            {...filterProps(group.label.toLowerCase(), choice.label, chosen === choice.id)}
            onClick={() => onChoose(choice.id)}
            className={`${SMALL_CHIP} ${chosen === choice.id ? "border-cobalt text-ink" : "border-white/15 text-ink-2"}`}
          >
            {choice.label}
            <span aria-hidden="true" className="ml-1 font-mono text-[11px]">
              {choice.count}
            </span>
            <span className="sr-only">{templateFilterSuffix(group.label.toLowerCase(), choice.count)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type CollectionProps = Readonly<{ collection: TemplateCollection; open: boolean; busy: boolean; onToggle: () => void }>;

export function Collection({ collection, open, busy, onToggle }: CollectionProps) {
  const headingId = `launch-templates-collection-${collection.key.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section {...collectionProps(headingId)} data-testid={headingId} className="flex min-w-0 flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-[13px] font-medium text-ink">
          {collection.label}
        </h3>
        {collection.hidden > 0 || open ? (
          <button {...showAllTemplatesProps(collection.label.toLowerCase(), open, collection.hidden)} onClick={onToggle} className={`${SMALL_CHIP} border-white/15 text-ink-2`}>
            {open ? SHOW_FEWER : SHOW_ALL}
          </button>
        ) : null}
      </header>
      <ul {...listProps(`${collection.label} templates`)} className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {collection.shown.map((card) => (
          <li key={card.slug} role="listitem" className="min-w-0">
            <TemplateCardRow card={card} busy={busy} />
          </li>
        ))}
      </ul>
    </section>
  );
}
