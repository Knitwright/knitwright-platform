"use client";

import { useId, useState } from "react";
import { FIELD_CONTROL, TEXT_AREA } from "@/components/ui/field-styles";
import type { LaunchPanelProps } from "@/lib/launch";
import { CREDIT_SETTINGS, PLACEHOLDER_NOTICE } from "@/lib/credits/settings";
import { MODEL_PRESET_CATALOGUE, MAX_PROMPT, SHOOT_GAP_RULE, readBoardSettings, writeBoardSettings, type ShootBoardSettings } from "@/lib/shoots";
import * as copy from "@/lib/shoots/copy";
import { CHIP, EmptyState, H4, HINT, Model, PLAIN, Result, Run, SECTION, Scene, Waiting, Chips } from "./BoardSections";
import { chipProps, listProps, panelProps } from "./a11y";
import { boardPanelView } from "./panel-model";

/**
 * THE AI IMAGE BOARD'S INSPECTOR: panel id `board-ai-image` of L1's contract (decision 0091).
 *
 * A default export taking exactly `LaunchPanelProps`. Every change goes to `setBoardSettings` and
 * every run to `requestRun`, so the shell checks the garment lock and shows the cost before anything
 * is spent, and this panel can put the project into no state a person could not reach by hand.
 *
 * What it decides is in `panel-model.ts`, tested against `panelDouble()` with no shell and no
 * browser; the sections are in `BoardSections.tsx`. This file is the order of the controls: the
 * scene, the waiting state, the model and its consent, the pose, the camera, the style, the shape,
 * how many, the background, the words, then **the cost in the Generate button's own visible words**,
 * and last the picture with the label the spec puts on it.
 */

/** The platform's own credit price, through L1's cost source, with the credits page's own notice. */
const SOURCE = { perGeneratedBoard: CREDIT_SETTINGS.prices.marketing_media, note: PLACEHOLDER_NOTICE, ruleId: SHOOT_GAP_RULE };

export default function AiImageBoardPanel({ context, commands }: LaunchPanelProps) {
  const board = context.selection?.board ?? null;
  const saved = readBoardSettings(board?.settings ?? {});
  const ids = { heading: useId(), prompt: useId(), background: useId(), consent: useId(), reason: useId() };
  // The prompt is typed into, so it is held here and saved when the field is left, against the board
  // it belongs to: selecting another board shows that board's own words.
  const [draft, setDraft] = useState<Readonly<{ boardId: string; text: string }> | null>(null);
  const prompt = draft && board && draft.boardId === board.id ? draft.text : saved.prompt;
  const [consentRef, setConsentRef] = useState("");

  const view = boardPanelView({ context, settings: saved, presets: MODEL_PRESET_CATALOGUE, creditsEnforced: false, source: SOURCE });
  const change = (next: Partial<ShootBoardSettings>): void => {
    if (board) commands.setBoardSettings(board.id, writeBoardSettings({ ...saved, ...next }));
  };

  return (
    <section {...panelProps(ids.heading, context.busy)} className="flex flex-col gap-4" data-testid="ai-image-panel">
      <header className="flex flex-col gap-1">
        <h3 id={ids.heading} className={H4}>
          {view.heading}
        </h3>
        <p className={HINT}>{view.lead}</p>
        <p className={HINT}>{copy.GARMENT_LOCKED}</p>
      </header>

      {view.empty ? (
        <EmptyState
          view={view}
          onAdd={() => {
            if (board) commands.addBoard("mockup", { x: board.at.x - 320, y: board.at.y }, board.id);
          }}
          onIdeas={() => commands.openPanel("ai-image")}
        />
      ) : (
        <>
          <Scene view={view} />
          <Waiting view={view} status={board?.status ?? "empty"} />
          <Model view={view} settings={saved} consentRef={consentRef} consentId={ids.consent} onRef={setConsentRef} onChange={change} />
          <Chips label={copy.POSE_LABEL} group="pose" choices={view.poses} busy={view.busy} onPick={(poseKey) => change({ poseKey })} />
          <Chips label={copy.CAMERA_LABEL} group="camera" choices={view.cameras} busy={view.busy} onPick={(cameraKey) => change({ cameraKey })} />
          <Chips label={copy.STYLE_LABEL} group="style" choices={view.styles} busy={view.busy} onPick={(style) => change({ style })} />
          <Chips label={copy.ASPECT_LABEL} group="shape" choices={view.aspects} busy={view.busy} onPick={(aspect) => change({ aspect })} />

          <div className={SECTION}>
            <span className={H4}>{copy.COUNT_LABEL}</span>
            <ul {...listProps(copy.COUNT_LABEL)} className="flex flex-wrap gap-1.5">
              {view.counts.map((one) => (
                <li key={one.value} role="listitem">
                  <button
                    {...chipProps("how many", one.label, one.selected)}
                    disabled={view.busy}
                    onClick={() => change({ count: Number(one.value) })}
                    className={`${CHIP} ${one.selected ? "border-cobalt-soft bg-cobalt-wash text-ink" : PLAIN}`}
                    data-testid={`shoot-count-${one.value}`}
                  >
                    {one.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className={HINT}>
              {copy.COUNT_HINT} {view.perImage}.
            </p>
          </div>

          <div className={SECTION}>
            <label htmlFor={ids.background} className={H4}>
              {copy.BACKGROUND_LABEL}
            </label>
            <input
              id={ids.background}
              type="text"
              value={saved.backgroundText}
              disabled={view.busy}
              placeholder="The scene's own background, or describe another"
              onChange={(event) => change({ backgroundSource: event.target.value.trim() === "" ? "scene" : "text", backgroundText: event.target.value })}
              className={`${FIELD_CONTROL} w-full`}
              data-testid="shoot-background"
            />
            <p className={HINT}>{copy.EXTRA_PRODUCTS_HINT}</p>
          </div>

          <div className={SECTION}>
            <label htmlFor={ids.prompt} className={H4}>
              {copy.PROMPT_LABEL}
            </label>
            <textarea
              id={ids.prompt}
              value={prompt}
              rows={3}
              maxLength={MAX_PROMPT}
              disabled={view.busy}
              aria-describedby={`${ids.prompt}-hint`}
              onChange={(event) => board && setDraft({ boardId: board.id, text: event.target.value })}
              onBlur={() => {
                change({ prompt });
                setDraft(null);
              }}
              className={`${TEXT_AREA} w-full`}
              data-testid="shoot-prompt"
            />
            <p id={`${ids.prompt}-hint`} className={HINT}>
              {copy.PROMPT_HINT}
            </p>
          </div>

          <Run view={view} reasonId={ids.reason} onRun={() => board && commands.requestRun(board.id)} />
          <Result view={view} />
        </>
      )}

      <footer className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
        {view.notes.map((note) => (
          <p key={note} className={HINT}>
            {note}
          </p>
        ))}
        {view.gaps.map((gap) => (
          <p key={gap.line} className={HINT} data-testid="shoot-board-gap">
            {gap.line} <span className="font-mono">{gap.ruleId}</span>
          </p>
        ))}
      </footer>
    </section>
  );
}
