"use client";

import { useId, useMemo, useState } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import type { LaunchPanelProps } from "@/lib/launch";
import {
  ALL_SHOOT_CONCEPTS,
  CLEAR_FILTERS,
  GARMENT_LOCKED,
  IDEAS_HEADING,
  IDEAS_PANEL_LEAD,
  IDEAS_PANEL_TITLE,
  NO_FILTERS,
  NO_IDEAS_BODY,
  NO_IDEAS_TITLE,
  NO_MATCH_BODY,
  NO_MATCH_TITLE,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOOT_STYLE_LABELS,
  USE_IDEA,
  anyFilterSet,
  filterConcepts,
  libraryGaps,
  moodChoices,
  peopleChoices,
  sportChoices,
  useIdeaSuffix,
  type ConceptFilters,
  type ShootConcept,
} from "@/lib/shoots";
import { alertProps, busyProps, chipProps, filterSuffix, groupProps, listProps, panelProps, useIdeaProps } from "./a11y";
import { ideaAction } from "./panel-model";

/**
 * THE SHOOT IDEAS PANEL: panel id `ai-image` of L1's contract (decision 0091).
 *
 * A default export taking exactly `LaunchPanelProps`, so the shell can load it with `next/dynamic`.
 * It asks and never writes: choosing an idea goes to `addBoard` or `setBoardSettings`, and nothing
 * here spends, meters or calls anything.
 *
 * What the owner asked for, on this screen: an empty state naming the one action that fills it, the
 * garment lock said out loud, labelled controls with visible focus rings, one list a screen reader
 * can count, and the phone layout this app already uses -- one column, two from `sm`, which is the
 * grid `components/mockups/MockupsPanel.tsx` uses for the same kind of shelf.
 */
export default function ShootsPanel({ context, commands }: LaunchPanelProps) {
  const ids = { heading: useId(), search: useId() };
  const [filters, setFilters] = useState<ConceptFilters>(NO_FILTERS);
  const [said, setSaid] = useState<string | null>(null);

  const concepts = ALL_SHOOT_CONCEPTS;
  const shown = useMemo(() => filterConcepts(concepts, filters), [concepts, filters]);
  const gaps = libraryGaps(concepts);


  /**
   * F-L1: a shoot idea starts an AI image board. With one already selected the idea's settings go
   * straight onto it; otherwise a board is added, fed by the Design board. `addBoard` does not hand
   * back the new board's id, so the panel says what to do next rather than half-setting something.
   */
  const use = (concept: ShootConcept) => {
    const action = ideaAction(context, concept);
    if (action.kind === "set") commands.setBoardSettings(action.boardId, action.settings);
    else if (action.fromBoardId === null) commands.addBoard("ai_image", action.at);
    else commands.addBoard("ai_image", action.at, action.fromBoardId);
    setSaid(action.said);
  };

  return (
    <section {...panelProps(ids.heading, context.busy)} className="flex min-h-0 flex-col gap-3" data-testid="shoots-panel">
      <header className="flex flex-col gap-1">
        <h2 id={ids.heading} className="text-[15px] font-medium text-ink">
          {IDEAS_PANEL_TITLE}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{IDEAS_PANEL_LEAD}</p>
        <p className="text-[12px] leading-relaxed text-ink-2">{GARMENT_LOCKED}</p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.search} className="text-[12px] text-ink-2">
          {SEARCH_LABEL}
        </label>
        <input
          id={ids.search}
          type="search"
          value={filters.text}
          placeholder={SEARCH_PLACEHOLDER}
          onChange={(event) => setFilters((was) => ({ ...was, text: event.target.value }))}
          className={`${FIELD_CONTROL} w-full`}
          data-testid="shoot-search"
        />
      </div>

      <FilterRow group="sport" choices={sportChoices(concepts)} chosen={filters.sport} onChoose={(value) => setFilters((was) => ({ ...was, sport: value }))} />
      <FilterRow group="mood" choices={moodChoices(concepts)} chosen={filters.mood} onChoose={(value) => setFilters((was) => ({ ...was, mood: value }))} />
      <FilterRow
        group="people"
        choices={peopleChoices(concepts)}
        chosen={filters.withPeople === null ? null : filters.withPeople ? "with" : "without"}
        onChoose={(value) => setFilters((was) => ({ ...was, withPeople: value === null ? null : value === "with" }))}
      />

      {said === null ? null : (
        <p {...busyProps()} data-testid="shoot-said" className="rounded-xl border border-cobalt-soft/50 px-2.5 py-2 text-[12px] leading-relaxed text-ink">
          {said}
        </p>
      )}

      {context.busy ? (
        <p {...busyProps()} className="text-[12px] text-ink-2" data-testid="shoot-busy">
          Saving…
        </p>
      ) : null}

      {concepts.length === 0 ? (
        <Empty title={NO_IDEAS_TITLE} body={NO_IDEAS_BODY} testId="shoot-no-ideas" />
      ) : shown.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Empty title={NO_MATCH_TITLE} body={NO_MATCH_BODY} testId="shoot-no-match" />
          {anyFilterSet(filters) ? (
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              data-testid="shoot-clear-filters"
              className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] text-ink"
            >
              {CLEAR_FILTERS}
            </button>
          ) : null}
        </div>
      ) : (
        <section {...groupProps(`${ids.heading}-ideas`)} className="flex flex-col gap-2">
          <h3 id={`${ids.heading}-ideas`} className="text-[13px] font-medium text-ink">
            {IDEAS_HEADING}
          </h3>
          <ul {...listProps("Shoot ideas")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {shown.map((concept) => (
              <li key={concept.slug} role="listitem">
                <IdeaCard concept={concept} busy={context.busy} onUse={use} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
        {gaps.map((gap) => (
          <p key={gap.line} {...alertProps()} className="text-[12px] leading-relaxed text-ink-2" data-testid="shoot-gap">
            {gap.line} <span className="font-mono">{gap.ruleId}</span>
          </p>
        ))}
      </footer>
    </section>
  );
}

function Empty({ title, body, testId }: Readonly<{ title: string; body: string; testId: string }>) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1 rounded-2xl border border-dashed border-white/20 p-4">
      <h3 className="text-[14px] font-medium text-ink">{title}</h3>
      <p className="text-[13px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

type FilterRowProps = Readonly<{
  group: string;
  choices: readonly { value: string; label: string; count: number }[];
  chosen: string | null;
  onChoose: (value: string | null) => void;
}>;

function FilterRow({ group, choices, chosen, onChoose }: FilterRowProps) {
  if (choices.length === 0) return null;
  return (
    <ul {...listProps(`${group} filters`)} className="flex flex-wrap gap-1.5" data-testid={`shoot-filter-${group}`}>
      {choices.map((one) => (
        <li key={one.value} role="listitem">
          <button
            {...chipProps(group, one.label, chosen === one.value)}
            onClick={() => onChoose(chosen === one.value ? null : one.value)}
            className={`chip-btn inline-flex min-h-9 items-center rounded-full border px-3 text-[12px] ${chosen === one.value ? "border-cobalt text-ink" : "border-white/15 text-ink-2"}`}
          >
            {one.label}
            <span aria-hidden="true" className="ml-1 font-mono text-[11px]">
              {one.count}
            </span>
            <span className="sr-only">{filterSuffix(group, one.count)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function IdeaCard({ concept, busy, onUse }: Readonly<{ concept: ShootConcept; busy: boolean; onUse: (concept: ShootConcept) => void }>) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid={`shoot-idea-${concept.slug}`}>
      <header className="flex flex-col gap-1">
        <h4 className="text-[13px] font-medium text-ink">{concept.title}</h4>
        <p className="text-[12px] leading-relaxed text-ink-2">{concept.lead}</p>
      </header>
      <dl className="flex flex-col gap-0.5 text-[11px] text-ink-2">
        <div className="flex gap-1">
          <dt className="font-medium">Light</dt>
          <dd>{concept.lighting}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Style</dt>
          <dd>{SHOOT_STYLE_LABELS[concept.style]}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">Pictures</dt>
          <dd>{concept.outputs.count}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">People</dt>
          <dd>{concept.needsModel ? "A person, so a model is needed" : "Nobody in the picture"}</dd>
        </div>
      </dl>
      <button
        {...useIdeaProps(concept.title, busy)}
        onClick={() => onUse(concept)}
        data-testid={`shoot-use-${concept.slug}`}
        className="chip-btn mt-auto inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] text-ink disabled:opacity-55"
      >
        {USE_IDEA}
        <span className="sr-only">{useIdeaSuffix(concept.title)}</span>
      </button>
    </article>
  );
}
