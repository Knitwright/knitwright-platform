"use client";

import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type { FabricDocJson } from "@/lib/panel-layers/fabric-types";

export type PanelCanvasProps = Readonly<{
  /** The layers to draw. Loading a new value replaces everything on the canvas. */
  doc: FabricDocJson;
  /** The window on the plane, in millimetres. */
  view: Readonly<{ x: number; y: number; w: number; h: number }>;
  widthPx: number;
  /** The canvas as it is now, while an object is being moved, and once after it is dropped. */
  onLive: (doc: FabricDocJson) => void;
  onCommit: (doc: FabricDocJson) => void;
  onSelect: (layerId: string | null) => void;
  selectedId: string | null;
}>;

/**
 * The only file that imports Fabric.js. The editor loads it with a dynamic import, so the library is fetched
 * when the prototype opens and never for the design editor (decision 0053).
 */
export default function PanelCanvas({ doc, view, widthPx, onLive, onCommit, onSelect, selectedId }: PanelCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const handlers = useRef({ onLive, onCommit, onSelect });
  const heightPx = Math.round((widthPx * view.h) / view.w);

  useEffect(() => {
    handlers.current = { onLive, onCommit, onSelect };
  });

  useEffect(() => {
    const container = host.current;
    const element = document.createElement("canvas");
    container?.replaceChildren(element);
    const canvas = new Canvas(element, { width: widthPx, height: heightPx, selection: false, preserveObjectStacking: true });
    const zoom = widthPx / view.w;
    canvas.setViewportTransform([zoom, 0, 0, zoom, -view.x * zoom, -view.y * zoom]);
    const snapshot = (): FabricDocJson => canvas.toObject(["kw"]) as unknown as FabricDocJson;
    const idOf = (): string | null => {
      const kw = canvas.getActiveObject()?.get("kw") as { layer?: { id?: string } } | undefined;
      return kw?.layer?.id ?? null;
    };
    for (const name of ["object:moving", "object:scaling", "object:rotating"] as const) canvas.on(name, () => handlers.current.onLive(snapshot()));
    for (const name of ["object:modified", "text:changed"] as const) canvas.on(name, () => handlers.current.onCommit(snapshot()));
    for (const name of ["selection:created", "selection:updated", "selection:cleared"] as const) canvas.on(name, () => handlers.current.onSelect(idOf()));
    canvasRef.current = canvas;
    return () => {
      canvasRef.current = null;
      void canvas.dispose();
      container?.replaceChildren();
    };
  }, [view.x, view.y, view.w, view.h, widthPx, heightPx]);

  useEffect(() => {
    let current = true;
    const canvas = canvasRef.current;
    void canvas?.loadFromJSON(doc).then(() => {
      if (!current) return;
      canvas.requestRenderAll();
      handlers.current.onLive(canvas.toObject(["kw"]) as unknown as FabricDocJson);
    });
    return () => {
      current = false;
    };
  }, [doc, view.x, view.y, view.w, view.h, widthPx, heightPx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const found = canvas.getObjects().find((object) => (object.get("kw") as { layer?: { id?: string } } | undefined)?.layer?.id === selectedId);
    if (found && canvas.getActiveObject() !== found) canvas.setActiveObject(found);
    if (!found) canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [selectedId, doc]);

  return <div ref={host} data-testid="panel-canvas" style={{ width: widthPx, height: heightPx }} className="absolute inset-0" />;
}
