"use client";

import { useEffect, useMemo, useState } from "react";
import type { EditorDesign } from "@/lib/editor";
import { panelPicturesAction } from "@/lib/gltf/actions";

/** What the panel pictures are asked for: one saved version, in the shown size, form and colourway. */
export type AtlasAsk = Readonly<{
  projectId: string;
  version: number;
  size: string;
  colourwayId: string | null;
  form: EditorDesign["form"];
}>;

const NONE: Readonly<Record<string, string>> = Object.freeze({});

/** The request for a design, or null when it has no model to paint. */
export const atlasAsk = (design: EditorDesign | null, hasModel: boolean): AtlasAsk | null =>
  design && hasModel
    ? { projectId: design.projectId, version: design.version, size: design.size, colourwayId: design.colourwayId || null, form: design.form }
    : null;

/**
 * The panel pictures the 3D view paints its atlas with (plan v6 D3, principle 3): the art of the
 * design's own print files, made on the server. Until they arrive, or if they cannot be made, the
 * record is empty and every island shows its material colour, as before.
 */
export function usePanelPictures(ask: AtlasAsk | null): Readonly<Record<string, string>> {
  const key = ask ? JSON.stringify(ask) : null;
  const [got, setGot] = useState<Readonly<{ key: string; pictures: Readonly<Record<string, string>> }> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    panelPicturesAction(JSON.parse(key) as AtlasAsk)
      .then((reply) => {
        if (live && reply.success) setGot({ key, pictures: reply.data });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);

  return useMemo(() => (got && got.key === key ? got.pictures : NONE), [got, key]);
}
