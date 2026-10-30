"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { Result } from "@/lib/server/core/errors";
import type { BoardView, MoodboardView, SuggestionsView } from "@/lib/inspiration/view";
import { openProps, panelProps } from "./a11y";
import { CardTile } from "./CardTile";
import { SuggestionList } from "./SuggestionList";
import { TagChips } from "./TagChips";

/** What the panel is given. Each is a server action; nothing here reaches a provider itself. */
export type BoardActions = Readonly<{
  load: (input: { projectId: string; productLinks: string[]; withMoodImage: boolean }) => Promise<Result<{ board: BoardView; moodboard: MoodboardView; version: number }>>;
  steer: (input: { projectId: string; tag: string; state: "pinned" | "removed" | null }) => Promise<Result<unknown>>;
  suggest: (input: { projectId: string; productLinks: string[]; cardId: string }) => Promise<Result<SuggestionsView>>;
  apply: (input: { projectId: string; expectedVersion: number; suggestionId: string; cardId: string; productLinks: string[] }) => Promise<Result<{ version: number }>>;
  save: (input: { projectId: string; productLinks: string[]; cardId: string }) => Promise<Result<unknown>>;
  remove: (input: { projectId: string; itemId: string }) => Promise<Result<unknown>>;
}>;

type Props = Readonly<{
  projectId: string;
  /** Product links the person added, which become link-preview cards (F-S2 adds them). */
  productLinks?: readonly string[];
  actions: BoardActions;
}>;

const FAILED = "The inspiration board could not be read just now. Try again.";

/** The links back as a list. An address never holds a space, so one word holds them all. */
const listOf = (key: string): string[] => (key === "" ? [] : key.split(" "));

/**
 * The inspiration side panel (spec F-S1). It reads the board for the design, shows the sources in the spec's order
 * with their cards, the Behance and Pinterest buttons, the suggestions one card gave, and the design's moodboard.
 *
 * Every refresh is one server action, because Next.js dispatches actions one at a time per client: asking for the
 * whole board in one call is what keeps a refresh inside F-S1's three seconds.
 */
export function BoardPanel({ projectId, productLinks = [], actions }: Props) {
  const headingId = useId();
  // The links come as a list; the panel keeps them as one word so a refresh is asked for only when they change.
  const linkKey = productLinks.join(" ");
  const links = listOf(linkKey);
  const [board, setBoard] = useState<BoardView | null>(null);
  const [moodboard, setMoodboard] = useState<MoodboardView | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [made, setMade] = useState<SuggestionsView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** Takes one answer from the board action. Called by the first read and by every change. */
  const take = (answer: Awaited<ReturnType<BoardActions["load"]>>): void => {
    if (!answer.success) return setProblem(answer.error.message || FAILED);
    setBoard(answer.data.board);
    setMoodboard(answer.data.moodboard);
    setVersion(answer.data.version);
    setProblem(null);
  };

  // The first read, and again whenever the design or the product links change. One action, because Next.js
  // dispatches actions one at a time per client: the whole board in one call is what keeps a refresh under 3 seconds.
  useEffect(() => {
    let live = true;
    void (async () => {
      const answer = await actions.load({ projectId, productLinks: listOf(linkKey), withMoodImage: false });
      if (!live) return;
      if (!answer.success) return setProblem(answer.error.message || FAILED);
      setBoard(answer.data.board);
      setMoodboard(answer.data.moodboard);
      setVersion(answer.data.version);
      setProblem(null);
    })();
    return () => {
      live = false;
    };
  }, [actions, projectId, linkKey]);

  const refresh = (withMoodImage = false) => start(async () => take(await actions.load({ projectId, productLinks: links, withMoodImage })));

  const run = (work: () => Promise<Result<unknown>>) =>
    start(async () => {
      const answer = await work();
      if (!answer.success) return setProblem(answer.error.message || FAILED);
      setProblem(null);
      take(await actions.load({ projectId, productLinks: links, withMoodImage: false }));
    });

  const askSuggestions = (cardId: string) =>
    start(async () => {
      const answer = await actions.suggest({ projectId, productLinks: links, cardId });
      if (!answer.success) return setProblem(answer.error.message || FAILED);
      setMade(answer.data);
      setProblem(null);
    });

  const applySuggestion = (suggestionId: string) => {
    const cardId = made?.suggestions.find((entry) => entry.id === suggestionId) ? suggestionId.split("|")[0] : null;
    if (cardId === null || version === null) return;
    run(() => actions.apply({ projectId, expectedVersion: version, suggestionId, cardId, productLinks: links }));
  };

  return (
    <div {...panelProps(headingId, pending)} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {board?.title ?? "Inspiration"}
      </h3>
      {problem === null ? null : (
        <p role="status" className="text-xs text-muted">
          {problem}
        </p>
      )}
      <TagChips
        tags={board?.tags ?? []}
        onPin={(tag, pinned) => run(() => actions.steer({ projectId, tag, state: pinned ? null : "pinned" }))}
        onRemove={(tag) => run(() => actions.steer({ projectId, tag, state: "removed" }))}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => refresh(false)} disabled={pending} className="soft-link font-medium">
          Refresh
        </button>
        <button type="button" onClick={() => refresh(true)} disabled={pending} className="soft-link font-medium">
          Make an AI mood image
        </button>
        {(board?.searchLinks ?? []).map((link) => (
          <a key={link.site} {...openProps(link.url, link.label)} className="soft-link font-medium">
            {link.label}
          </a>
        ))}
      </div>
      {board?.empty === null ? null : (
        <p className="text-xs text-muted" role="status">
          {board?.empty ?? "Reading the board."}
        </p>
      )}
      {(board?.sources ?? []).map((source) => (
        <section key={source.label} className="flex flex-col gap-1" data-testid="inspiration-source">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{source.label}</h4>
          {source.unavailable === null ? (
            <ul className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label={`${source.label} cards`}>
              {source.cards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  busy={pending}
                  onSuggest={() => askSuggestions(card.id)}
                  onSave={() => run(() => actions.save({ projectId, productLinks: links, cardId: card.id }))}
                />
              ))}
            </ul>
          ) : (
            <p className="text-[0.7rem] text-muted">{source.unavailable}</p>
          )}
        </section>
      ))}
      {made === null ? null : <SuggestionList made={made} busy={pending} onApply={applySuggestion} />}
      {moodboard === null ? null : (
        <section className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{moodboard.title}</h4>
          {moodboard.empty === null ? (
            <ul className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Saved inspiration">
              {moodboard.items.map((item) => (
                <li key={item.id} className="glass flex w-32 shrink-0 flex-col gap-1 rounded-xl p-1" data-testid="moodboard-item">
                  <a {...openProps(item.openUrl, `Open "${item.title}"`)} className="block overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked from the provider; never stored. */}
                    <img src={item.previewUrl} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-20 w-full object-cover" />
                  </a>
                  <p className="text-[0.65rem] text-ink">{item.title}</p>
                  <p className="text-[0.6rem] text-muted">{item.notice}</p>
                  <button type="button" onClick={() => run(() => actions.remove({ projectId, itemId: item.id }))} aria-label={item.removeLabel} className="soft-link text-[0.65rem]">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{moodboard.empty}</p>
          )}
        </section>
      )}
    </div>
  );
}
