"use client";

import { useEffect, useReducer, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { acceptBody, canAccept, hasMoves, initialScreen, screenReducer } from "@/lib/design-import/screen";
import type { ImportView } from "@/lib/design-import/view-model";
import { uploadArtwork } from "@/lib/artwork-intake/client";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { accept, discard, readPicture, refit, replaceLayer, uploadPicture } from "./api";
import { SideBySide } from "./SideBySide";

const STAGE_TEXT = { uploading: "Uploading the picture...", reading: "Reading the picture...", working: "Working..." } as const;

/**
 * What accepting really does today, said before the person accepts and again afterwards. Putting an
 * accepted reading onto the design it was read for is not built, so neither sentence says it is.
 */
export const NOT_APPLIED_YET =
  "Accepting keeps the reading and keeps the pictures cut from yours in your artwork. It does not change this design: putting an accepted reading onto the design it was read for is not built yet, so your design is left as it was.";

/**
 * A reading is kept on the server the moment it is made, and this panel does not look for one when
 * it opens, so leaving the screen and coming back starts from the picture again -- and reading a
 * picture again is another reading, which costs. The person is told that before they start, rather
 * than finding out by losing one. `GET /api/design-import` already lists a brand's readings, so
 * finding the last one again is a small piece of work nobody has owned yet (decision 0124).
 */
export const RELOAD_STARTS_AGAIN =
  "Leave this screen before you accept and the panel starts again from the picture. Your reading is kept, but this panel does not find it again, and reading a picture a second time is a second reading.";

const KEPT_NOT_APPLIED = "Accepted. The reading is kept and its pictures are in your artwork. This design is unchanged.";

/**
 * Hand over a mockup, a flat, a photo of a kit or a sketch and see a close reading of it beside the picture. Nothing is kept
 * until you accept. The panel is shown only while the feature is switched on (the routes answer 404 otherwise).
 *
 * WHAT ACCEPTING DOES, AND WHAT IT DOES NOT DO. `acceptImport` keeps the chosen layers on the reading's own row and keeps
 * the pictures cut from the picture as the brand's artwork. **It does not write them onto the design this panel is open
 * on**: decision 0038 item 6 left applying an accepted stack to a project's design to the step after it, and nothing in
 * the repository does it yet (`designWithStack` is the function that would, and no import path calls it). So the panel
 * says that in its own words, where the person deciding can read it, rather than letting "Saved" imply a design changed.
 * When that step is built, this note and the sentence after an accept are what change.
 */
export function DesignImportPanel() {
  const [state, dispatch] = useReducer(screenReducer, initialScreen);
  const [view, setView] = useState<ImportView | null>(null);
  const [rights, setRights] = useState(false);

  useEffect(() => {
    const url = state.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state.previewUrl]);

  const layerIds = view?.rows.map((row) => row.id) ?? [];
  const busy = state.stage === "uploading" || state.stage === "reading" || state.stage === "working";

  const choose = async (file: File | undefined) => {
    if (!file || !rights) return;
    dispatch({ type: "chosen", previewUrl: URL.createObjectURL(file) });
    const uploaded = await uploadPicture(file);
    if (!uploaded.ok) return dispatch({ type: "failed", message: uploaded.message });
    dispatch({ type: "uploaded" });
    const reading = await readPicture(uploaded.data);
    if (!reading.ok) return dispatch({ type: "failed", message: reading.message });
    setView(reading.data);
    dispatch({ type: "ready", importId: reading.data.id, layerIds: reading.data.rows.map((row) => row.id) });
  };

  const redo = async () => {
    if (!state.importId) return;
    dispatch({ type: "working" });
    const reading = await refit(state.importId, state.moved);
    if (!reading.ok) return dispatch({ type: "failed", message: reading.message });
    setView(reading.data);
    dispatch({ type: "refitted", layerIds: reading.data.rows.map((row) => row.id) });
  };

  const replace = async (layerId: string, file: File, confirmed: boolean): Promise<string | null> => {
    if (!state.importId) return "There is no reading to change.";
    const artwork = await uploadArtwork((input, init) => fetch(input, init), file, confirmed);
    if (!artwork.ok) return artwork.reason;
    const reading = await replaceLayer(state.importId, layerId, artwork.data.id);
    if (!reading.ok) return reading.message;
    setView(reading.data);
    return null;
  };

  const accepted = async () => {
    if (!state.importId || !canAccept(state)) return;
    dispatch({ type: "working" });
    const result = await accept(state.importId, acceptBody(state, layerIds).layerIds);
    if (!result.ok) return dispatch({ type: "failed", message: result.message });
    const own = result.data.needsOwnFile.length;
    const redrawn = own > 0 ? ` ${own} ${own === 1 ? "layer was" : "layers were"} redrawn from your picture: replace ${own === 1 ? "it" : "them"} with your own file.` : "";
    dispatch({ type: "done", message: `${KEPT_NOT_APPLIED}${redrawn}` });
  };

  const thrown = async () => {
    if (state.importId) await discard(state.importId);
    setView(null);
    dispatch({ type: "discard" });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="design-import">
      <p className="text-[15px] leading-relaxed text-muted">
        Hand over a mockup, a flat, a photo of a kit or a sketch. You get a close reading of your picture to look at beside it. Nothing is kept until you accept it.
      </p>
      <Notice>
        {NOT_APPLIED_YET} {RELOAD_STARTS_AGAIN}
      </Notice>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" className="mt-1 size-4" checked={rights} disabled={busy} onChange={(event) => setRights(event.target.checked)} />
        <span>
          {LOGO_RIGHTS.text} The picture is sent to the providers that read it.
        </span>
      </label>
      {state.stage === "idle" || state.stage === "failed" || state.stage === "done" ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Choose a picture
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!rights} onChange={(event) => void choose(event.target.files?.[0])} className="min-h-10 text-sm" />
        </label>
      ) : null}
      {busy ? (
        <p role="status" className="text-sm text-muted">
          {STAGE_TEXT[state.stage as keyof typeof STAGE_TEXT]}
        </p>
      ) : null}
      {state.stage === "failed" && state.message ? (
        <Notice tone="warn" role="alert">
          {state.message}
        </Notice>
      ) : null}
      {state.stage === "done" && state.message ? <Notice tone="ok">{state.message}</Notice> : null}
      {view && (state.stage === "review" || state.stage === "working") ? (
        <>
          <SideBySide view={view} ticked={state.ticked} moved={state.moved} busy={busy} onTick={(id, on) => dispatch({ type: "tick", id, on })} onMove={(v, id, x, y) => dispatch({ type: "move", view: v, id, x, y })} onReplace={replace} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void accepted()} disabled={!canAccept(state) || busy}>
              {layerIds.every((id) => state.ticked.has(id)) ? "Accept all layers" : "Accept the layers I chose"}
            </Button>
            <Button variant="secondary" onClick={() => void redo()} disabled={!hasMoves(state) || busy}>
              Redo the fit with my landmarks
            </Button>
            <Button variant="quiet" onClick={() => void thrown()} disabled={busy}>
              Discard
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
