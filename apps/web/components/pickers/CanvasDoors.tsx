"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ArtboardPreset, LaunchProjectView } from "@/lib/launch";
import { historyDesign } from "@/lib/pickers";
import { ArtboardSizeModal } from "./ArtboardSizeModal";
import { VersionHistory } from "./VersionHistory";

/**
 * The two doors E5 puts by the project's name on the canvas (decision 0149): **Add board**, which
 * opens Choose Artboard Size, and the clock that opens Version history. One component so the launch
 * shell mounts them with one line; E2's right-panel header (`08` v3.2: project name + version-history
 * icon) can move them as they are.
 */

type Props = Readonly<{
  project: LaunchProjectView;
  presets: readonly ArtboardPreset[];
  canEdit: boolean;
  /** The board selected on the canvas, whose design the history shows when it is a garment. */
  selectedId: string | null;
}>;

export function CanvasDoors({ project, presets, canEdit, selectedId }: Props) {
  const [sizing, setSizing] = useState(false);
  return (
    <div className="flex items-center gap-1" data-testid="canvas-doors">
      {canEdit ? (
        <Button variant="secondary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={() => setSizing(true)} data-testid="add-board">
          Add board
        </Button>
      ) : null}
      <VersionHistory designProjectId={historyDesign(project.boards, selectedId ? [selectedId] : [], project.designProjectId)} canEdit={canEdit} />
      <ArtboardSizeModal open={sizing} onClose={() => setSizing(false)} launchProjectId={project.id} presets={presets} boards={project.boards} />
    </div>
  );
}
