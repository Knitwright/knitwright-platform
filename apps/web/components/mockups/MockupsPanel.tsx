"use client";

import { useId, useMemo, useState } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import {
  ALL_MOCKUP_SCENES,
  ARTICLE_FILTER_GAP,
  CLEAR_FILTERS,
  FREE_ONLY_LABEL,
  GARMENT_LOCKED,
  MOCKUPS_PANEL_LEAD,
  MOCKUPS_PANEL_TITLE,
  NO_MATCH_BODY,
  NO_MATCH_TITLE,
  NO_SCENES_BODY,
  NO_SCENES_TITLE,
  NO_FILTERS,
  PLACEMENT_FIXED,
  SCENES_FROM_SEED,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_ALL,
  SHOW_FEWER,
  boardAdded,
  collectionsOf,
  cropChoices,
  defaultSettings,
  moodChoices,
  peopleChoices,
  sceneSet,
  settingsToStored,
  sportChoices,
  specCountGap,
  type Crop,
  type MockupScene,
  type PeopleBand,
  type SceneFilters,
  type SceneGroup,
} from "@/lib/mockups";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { alertProps, busyProps, collectionProps, filterProps, listProps, panelProps, showAllProps } from "./a11y";
import { SceneCard } from "./SceneCard";

/**
 * THE MOCKUP LIBRARY PANEL (spec F-L1; plan v5 L2; decision 0092).
 *
 * It takes `LaunchPanelProps` and nothing else, so the launch shell can mount it wherever the rail's
 * `mockups` panel goes (`lib/launch/panels.ts`). Every change it asks for is a command -- a request
 * the shell checks, saves and redraws -- so this panel cannot put the project into a state a person
 * could not have reached by hand.
 *
 * `07`'s seven groups are the collections, each shown short with a Show all. Search covers the words
 * a person would type: the title, the group, the light, the backdrop, the pose and the camera. The
 * filters are sport, mood, people and aspect, plus "free scenes only", which is the deterministic
 * half. **F-L1's article filter is not offered and the panel says why**: a scene is not tied to one
 * article, so there would be nothing to filter on.
 */
export default function MockupsPanel({ context, commands }: LaunchPanelProps) {
  const ids = { heading: useId(), search: useId(), free: useId() };
  const [filters, setFilters] = useState<SceneFilters>(NO_FILTERS);
  const [expanded, setExpanded] = useState<readonly SceneGroup[]>([]);
  const [said, setSaid] = useState<string | null>(null);

  const scenes = ALL_MOCKUP_SCENES;
  const collections = useMemo(() => collectionsOf(scenes, filters, expanded), [scenes, filters, expanded]);
  const countGap = specCountGap(scenes);

  const design = context.project.boards.find((board) => board.kind === "design") ?? null;
  const selected = context.selection?.board ?? null;

  /**
   * F-L1: "Clicking a mockup creates a Mockup board linked to the design version by a connector."
   * With a mockup board already selected the scene goes straight on it; otherwise a board is added,
   * fed by the Design board. The shell's `addBoard` does not hand back the new board's id, so the
   * panel says what to do next rather than half-setting something.
   */
  const use = (scene: MockupScene) => {
    if (selected?.kind === "mockup") {
      commands.setBoardSettings(selected.id, settingsToStored(defaultSettings(scene)));
      setSaid(sceneSet(scene.title));
      return;
    }
    const at = design === null ? { x: 0, y: 0 } : { x: design.at.x + design.size.width + 60, y: design.at.y };
    commands.addBoard("mockup", at, design?.id);
    setSaid(boardAdded(scene.title));
  };

  const toggle = (group: SceneGroup) => setExpanded((open) => (open.includes(group) ? open.filter((one) => one !== group) : [...open, group]));

  return (
    <section {...panelProps(ids.heading, context.busy)} className="flex min-h-0 flex-col gap-3" data-testid="mockups-panel">
      <header className="flex flex-col gap-1">
        <h2 id={ids.heading} className="text-[15px] font-medium text-ink">
          {MOCKUPS_PANEL_TITLE}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{MOCKUPS_PANEL_LEAD}</p>
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
          data-testid="mockup-search"
        />
      </div>

      <FilterRow
        group="sport"
        choices={sportChoices(scenes)}
        chosen={filters.sport}
        onChoose={(value) => setFilters((was) => ({ ...was, sport: value }))}
      />
      <FilterRow group="mood" choices={moodChoices(scenes)} chosen={filters.mood} onChoose={(value) => setFilters((was) => ({ ...was, mood: value }))} />
      <FilterRow
        group="people"
        choices={peopleChoices(scenes)}
        chosen={filters.people}
        onChoose={(value) => setFilters((was) => ({ ...was, people: value as PeopleBand | null }))}
      />
      <FilterRow group="aspect" choices={cropChoices(scenes)} chosen={filters.crop} onChoose={(value) => setFilters((was) => ({ ...was, crop: value as Crop | null }))} />

      <div className="flex items-center gap-2">
        <input
          id={ids.free}
          type="checkbox"
          checked={filters.freeOnly}
          onChange={(event) => setFilters((was) => ({ ...was, freeOnly: event.target.checked }))}
          className="size-4 rounded border-hairline"
          data-testid="mockup-free-only"
        />
        <label htmlFor={ids.free} className="text-[13px] text-ink">
          {FREE_ONLY_LABEL}
        </label>
      </div>

      {said === null ? null : (
        <p {...busyProps()} data-testid="mockup-said" className="rounded-xl border border-cobalt-soft/50 px-2.5 py-2 text-[12px] leading-relaxed text-ink">
          {said}
        </p>
      )}

      {context.busy ? (
        <p {...busyProps()} className="text-[12px] text-ink-2" data-testid="mockup-busy">
          Saving…
        </p>
      ) : null}

      {scenes.length === 0 ? (
        <Empty title={NO_SCENES_TITLE} body={NO_SCENES_BODY} testId="mockup-no-scenes" />
      ) : collections.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Empty title={NO_MATCH_TITLE} body={NO_MATCH_BODY} testId="mockup-no-match" />
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            data-testid="mockup-clear-filters"
            className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] text-ink"
          >
            {CLEAR_FILTERS}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {collections.map((collection) => (
            <Collection
              key={collection.group}
              label={collection.label}
              group={collection.group}
              shown={collection.shown}
              hidden={collection.hidden}
              open={expanded.includes(collection.group)}
              busy={context.busy}
              onToggle={() => toggle(collection.group)}
              onUse={use}
            />
          ))}
        </div>
      )}

      <footer className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
        <p className="text-[12px] leading-relaxed text-ink-2">{PLACEMENT_FIXED}</p>
        <p className="text-[12px] leading-relaxed text-ink-2">{SCENES_FROM_SEED}</p>
        <p {...alertProps()} className="text-[12px] leading-relaxed text-ink-2" data-testid="mockup-article-filter-gap">
          {ARTICLE_FILTER_GAP.line} <span className="font-mono">{ARTICLE_FILTER_GAP.ruleId}</span>
        </p>
        {countGap === null ? null : (
          <p className="text-[12px] leading-relaxed text-ink-2" data-testid="mockup-count-gap">
            {countGap.line} <span className="font-mono">{countGap.ruleId}</span>
          </p>
        )}
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
    <ul {...listProps(`${group} filters`)} className="flex flex-wrap gap-1.5" data-testid={`mockup-filter-${group}`}>
      {choices.map((choice) => (
        <li key={choice.value} role="listitem">
          <button
            {...filterProps(group, choice.label, chosen === choice.value)}
            onClick={() => onChoose(chosen === choice.value ? null : choice.value)}
            className={`chip-btn inline-flex min-h-9 items-center rounded-full border px-3 text-[12px] ${chosen === choice.value ? "border-cobalt text-ink" : "border-white/15 text-ink-2"}`}
          >
            {choice.label} <span className="ml-1 font-mono text-[11px]">{choice.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type CollectionProps = Readonly<{
  label: string;
  group: SceneGroup;
  shown: readonly MockupScene[];
  hidden: number;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onUse: (scene: MockupScene) => void;
}>;

function Collection({ label, group, shown, hidden, open, busy, onToggle, onUse }: CollectionProps) {
  const headingId = `mockup-collection-${group}`;
  return (
    <section {...collectionProps(headingId)} data-testid={`mockup-collection-${group}`} className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-[13px] font-medium text-ink">
          {label}
        </h3>
        {hidden > 0 || open ? (
          <button
            {...showAllProps(label.toLowerCase(), open, hidden)}
            onClick={onToggle}
            data-testid={`mockup-show-all-${group}`}
            className="chip-btn inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-[12px] text-ink-2"
          >
            {open ? SHOW_FEWER : SHOW_ALL}
          </button>
        ) : null}
      </header>
      <ul {...listProps(`${label} scenes`)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {shown.map((scene) => (
          <li key={scene.slug} role="listitem">
            <SceneCard scene={scene} busy={busy} onUse={onUse} />
          </li>
        ))}
      </ul>
    </section>
  );
}
