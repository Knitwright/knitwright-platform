"use client";

import { useId, useState } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { isGarmentKind, type LaunchPanelProps } from "@/lib/launch";
import {
  BOARD_PANEL_LEAD,
  BOARD_PANEL_TITLE,
  COLOURWAY_BY_NAME,
  CONVERT_HELP,
  CONVERT_LABEL,
  CROP_LABEL,
  CROP_LABELS,
  GAPS_HEADING,
  KIT_LABEL,
  KIT_ROLES,
  KIT_ROLE_LABELS,
  NEEDS_DESIGN,
  NO_BOARD_SCENE_BODY,
  NO_BOARD_SCENE_TITLE,
  OPEN_MOCKUPS,
  PLACEMENT_FIXED,
  RENDERING_HINT,
  RENDER_LABEL,
  ROSTER_NAME_LABEL,
  ROSTER_NAME_MAX,
  ROSTER_NUMBER_LABEL,
  ROSTER_ON_LABEL,
  SCENE_LABEL,
  TURNED_VIEW_LEAD,
  convertToImage,
  isCrop,
  rosterLabel,
  rosterProblem,
  sceneBySlug,
  sceneGaps,
  sceneSlugOf,
  settingsFrom,
  settingsToStored,
  staleAgainst,
  startingRoster,
  type Crop,
  type KitRole,
  type MockupBoardSettings,
} from "@/lib/mockups";
import { alertProps, panelProps } from "./a11y";
import { SceneThumb, THUMB_NOTE } from "./SceneThumb";

/**
 * THE INSPECTOR OF A SELECTED MOCKUP BOARD (spec F-L1, "Mockup board"; decision 0092).
 *
 * Four things, and no fifth: the scene, the crop, the kit, and the name and number on the shirt.
 * **There is no placement control**, because F-L1 says there is not one ("Users cannot drag the
 * print area"); the scene's own garment slot decides where the garment sits, and the panel says so.
 *
 * Every change is a `setBoardSettings` request, so the shell checks it, saves it and redraws. Convert
 * to image hands the shell a `DrawnAsset`, which is the only shape this workstream can make: a
 * generated picture cannot be written down here at all (`lib/mockups/assets.ts`).
 */
export default function MockupBoardPanel({ context, commands }: LaunchPanelProps) {
  const ids = { heading: useId(), crop: useId(), kit: useId(), roster: useId(), name: useId(), number: useId() };
  const [problem, setProblem] = useState<string | null>(null);
  const board = context.selection?.board ?? null;

  if (board === null) return null;

  const scene = sceneBySlug(sceneSlugOf(board.settings) ?? "");
  const designFeedsIt = context.project.edges.some(
    (edge) => edge.toBoardId === board.id && context.project.boards.some((one) => one.id === edge.fromBoardId && isGarmentKind(one.kind)),
  );

  const save = (next: MockupBoardSettings) => commands.setBoardSettings(board.id, settingsToStored(next));

  if (scene === null) {
    return (
      <section {...panelProps(ids.heading, context.busy)} className="flex flex-col gap-2" data-testid="mockup-board-panel">
        <h3 id={ids.heading} className="text-[15px] font-medium text-ink">
          {BOARD_PANEL_TITLE}
        </h3>
        <div data-testid="mockup-board-no-scene" className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/20 p-4">
          <h4 className="text-[14px] font-medium text-ink">{NO_BOARD_SCENE_TITLE}</h4>
          <p className="text-[13px] leading-relaxed text-ink-2">{NO_BOARD_SCENE_BODY}</p>
          <button
            type="button"
            disabled={context.busy}
            onClick={() => commands.openPanel("mockups")}
            data-testid="mockup-board-open-library"
            className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
          >
            {OPEN_MOCKUPS}
          </button>
        </div>
      </section>
    );
  }

  const settings = settingsFrom(board.settings, scene);
  const stale = staleAgainst(board.inputVersion, latestVersion(context.project.boards));
  const gaps = sceneGaps(scene);

  const setRoster = (name: string, number: string) => {
    const said = rosterProblem(name, number);
    setProblem(said);
    if (said === null) save({ ...settings, roster: { name: name.trim(), number: number.trim() } });
  };

  return (
    <section {...panelProps(ids.heading, context.busy)} className="flex flex-col gap-3" data-testid="mockup-board-panel">
      <header className="flex flex-col gap-1">
        <h3 id={ids.heading} className="text-[15px] font-medium text-ink">
          {BOARD_PANEL_TITLE}
        </h3>
        <p className="text-[13px] leading-relaxed text-ink-2">{BOARD_PANEL_LEAD}</p>
      </header>

      <div className="flex gap-3">
        <div className="w-24 shrink-0">
          <SceneThumb scene={scene} />
        </div>
        <dl className="flex min-w-0 flex-col gap-0.5 text-[12px] text-ink-2">
          <dt className="font-medium text-ink">{SCENE_LABEL}</dt>
          <dd className="text-[13px] text-ink" data-testid="mockup-board-scene">
            {scene.title}
          </dd>
          <dd>{scene.lighting}</dd>
          <dd>{THUMB_NOTE}</dd>
        </dl>
      </div>

      {designFeedsIt ? null : (
        <p {...alertProps()} data-testid="mockup-board-needs-design" className="rounded-2xl border border-warn/30 bg-warn-wash px-3 py-2 text-[13px] leading-relaxed text-warn">
          {NEEDS_DESIGN}
        </p>
      )}

      {stale.stale ? (
        <p {...alertProps()} data-testid="mockup-board-stale" className="rounded-2xl border border-warn/30 bg-warn-wash px-3 py-2 text-[13px] leading-relaxed text-warn">
          {stale.line}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.crop} className="text-[12px] text-ink-2">
          {CROP_LABEL}
        </label>
        <select
          id={ids.crop}
          value={settings.crop}
          disabled={context.busy}
          onChange={(event) => isCrop(event.target.value) && save({ ...settings, crop: event.target.value as Crop })}
          className={`${FIELD_CONTROL} w-full`}
          data-testid="mockup-board-crop"
        >
          {scene.crops.map((crop) => (
            <option key={crop} value={crop}>
              {CROP_LABELS[crop]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[12px] text-ink-2">{KIT_LABEL}</legend>
        <div className="flex flex-wrap gap-1.5" data-testid="mockup-board-kit">
          {KIT_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              aria-pressed={settings.kitRole === role}
              aria-label={`Draw the ${KIT_ROLE_LABELS[role]} kit`}
              disabled={context.busy}
              onClick={() => save({ ...settings, kitRole: role as KitRole })}
              className={`chip-btn inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] ${settings.kitRole === role ? "border-cobalt text-ink" : "border-white/15 text-ink-2"}`}
            >
              {KIT_ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-ink-2">{COLOURWAY_BY_NAME}</p>
      </fieldset>

      <div className="flex items-center gap-2">
        <input
          id={ids.roster}
          type="checkbox"
          checked={settings.roster !== null}
          disabled={context.busy}
          onChange={(event) => save({ ...settings, roster: event.target.checked ? startingRoster() : null })}
          className="size-4 rounded border-hairline"
          data-testid="mockup-board-roster-on"
        />
        <label htmlFor={ids.roster} className="text-[13px] text-ink">
          {ROSTER_ON_LABEL}
        </label>
      </div>

      {settings.roster === null ? null : (
        <div className="flex flex-col gap-1.5" data-testid="mockup-board-roster">
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={ids.name} className="text-[12px] text-ink-2">
                {ROSTER_NAME_LABEL}
              </label>
              <input
                id={ids.name}
                maxLength={ROSTER_NAME_MAX}
                defaultValue={settings.roster.name}
                disabled={context.busy}
                aria-invalid={problem !== null}
                onBlur={(event) => setRoster(event.target.value, settings.roster?.number ?? "")}
                className={`${FIELD_CONTROL} w-full`}
                data-testid="mockup-board-roster-name"
              />
            </div>
            <div className="flex w-20 flex-col gap-1.5">
              <label htmlFor={ids.number} className="text-[12px] text-ink-2">
                {ROSTER_NUMBER_LABEL}
              </label>
              <input
                id={ids.number}
                inputMode="numeric"
                maxLength={2}
                defaultValue={settings.roster.number}
                disabled={context.busy}
                aria-invalid={problem !== null}
                onBlur={(event) => setRoster(settings.roster?.name ?? "", event.target.value)}
                className={`${FIELD_CONTROL} w-full`}
                data-testid="mockup-board-roster-number"
              />
            </div>
          </div>
          <p className="text-[12px] text-ink-2" data-testid="mockup-board-roster-shown">
            On the shirt: {rosterLabel(settings.roster)}
          </p>
          {problem === null ? null : (
            <p {...alertProps()} data-testid="mockup-board-roster-problem" className="text-[12px] text-warn">
              {problem}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={context.busy}
          onClick={() => commands.requestRun(board.id)}
          data-testid="mockup-board-render"
          className="chip-btn inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-[13px] font-medium text-ink"
        >
          {RENDER_LABEL}
        </button>
        <ConvertButton
          busy={context.busy}
          fileId={board.outputFileId}
          onConvert={(fileId) => {
            const made = convertToImage({ fileId, contentType: "image/png" });
            if (made.ok) commands.offerAsset(board.id, made.asset);
            else setProblem(made.reason);
          }}
        />
      </div>
      <p className="text-[12px] leading-relaxed text-ink-2">{RENDERING_HINT}</p>
      <p className="text-[12px] leading-relaxed text-ink-2">{CONVERT_HELP}</p>
      <p className="text-[12px] leading-relaxed text-ink-2">{PLACEMENT_FIXED}</p>

      {gaps.length === 0 ? null : (
        <section className="flex flex-col gap-1 rounded-xl border border-warn/30 bg-warn-wash px-2.5 py-2" data-testid="mockup-board-gaps">
          <h4 className="text-[11px] font-medium tracking-[0.04em] text-warn uppercase">{GAPS_HEADING}</h4>
          <ul className="flex flex-col gap-1">
            {gaps.map((gap) => (
              <li key={gap.line} className="text-[12px] leading-relaxed text-warn">
                <span className="font-medium">{TURNED_VIEW_LEAD}: </span>
                {gap.line} <span className="font-mono text-[11px]">{gap.ruleId}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/** The newest design version anything on this canvas was drawn from, or null. */
const latestVersion = (boards: readonly { readonly inputVersion: number | null }[]): number | null => {
  const versions = boards.map((board) => board.inputVersion).filter((version): version is number => version !== null);
  return versions.length === 0 ? null : Math.max(...versions);
};

function ConvertButton({ busy, fileId, onConvert }: Readonly<{ busy: boolean; fileId: string | null; onConvert: (fileId: string) => void }>) {
  const ready = fileId !== null;
  return (
    <button
      type="button"
      disabled={busy || !ready}
      title={ready ? CONVERT_HELP : "Draw this mockup first, then it can be baked into a picture."}
      onClick={() => fileId !== null && onConvert(fileId)}
      data-testid="mockup-board-convert"
      className="chip-btn inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-[13px] text-ink disabled:opacity-55"
    >
      {CONVERT_LABEL}
    </button>
  );
}
