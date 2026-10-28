"use client";

import { useCallback, useMemo, useState } from "react";
import type { ArtworkStack } from "@/lib/artwork-stack";
import type { Finding, Panel } from "@/lib/guardrails";
import { savePanelLayersAction } from "@/lib/panel-layers/actions";
import { addTextLayer, moveLayer, removeLayer } from "@/lib/panel-layers/edit";
import type { FabricDocJson } from "@/lib/panel-layers/fabric-types";
import { fromFabric } from "@/lib/panel-layers/from-fabric";
import { frameOf } from "@/lib/panel-layers/geometry";
import { layerChecks, type AssetFacts } from "@/lib/panel-layers/guardrail-input";
import { toFabric } from "@/lib/panel-layers/to-fabric";

const VIEW = "front";
const NEW_TEXT = "Your text";

type Input = Readonly<{ projectId: string; version: number; stack: ArtworkStack; panel: Panel; facts: AssetFacts }>;

/** The state of the prototype: the stack is the truth, and the canvas is drawn from it. */
export function usePanelLayers({ projectId, version, stack: first, panel, facts }: Input) {
  const frame = useMemo(() => frameOf(panel.cutOutline), [panel]);
  const [stack, setStack] = useState(first);
  const [saved, setSaved] = useState({ stack: first, version });
  const [canvasDoc, setCanvasDoc] = useState(() => toFabric(first, VIEW, frame));
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** A change made outside the canvas (add, remove, reorder): the canvas is drawn again from the new stack. */
  const replace = useCallback((next: ArtworkStack) => {
    setStack(next);
    setCanvasDoc(toFabric(next, VIEW, frame));
    setMessage(null);
  }, [frame]);

  const live = useCallback((doc: FabricDocJson) => setFindings(layerChecks(stack, doc, panel, facts)), [stack, panel, facts]);

  const commit = useCallback((doc: FabricDocJson) => {
    const merged = fromFabric(stack, VIEW, doc, frame);
    if (merged.ok) setStack(merged.stack);
    setMessage(merged.ok ? null : merged.reason);
  }, [stack, frame]);

  const save = useCallback(async () => {
    setSaving(true);
    const result = await savePanelLayersAction({ projectId, expectedVersion: saved.version, stack });
    setSaving(false);
    if (result.success) {
      setSaved({ stack, version: result.data.version });
      setMessage(`Saved as version ${result.data.version}.`);
    } else setMessage(result.error.message);
  }, [projectId, saved.version, stack]);

  return {
    frame,
    stack,
    canvasDoc,
    findings,
    selectedId,
    message,
    saving,
    version: saved.version,
    dirty: stack !== saved.stack,
    viewLayers: stack.layers.filter((layer) => layer.views.includes(VIEW)),
    select: setSelectedId,
    live,
    commit,
    save,
    addText: () => replace(addTextLayer(stack, VIEW, NEW_TEXT)),
    remove: (id: string) => replace(removeLayer(stack, id)),
    move: (id: string, direction: "up" | "down") => replace(moveLayer(stack, VIEW, id, direction)),
  };
}
