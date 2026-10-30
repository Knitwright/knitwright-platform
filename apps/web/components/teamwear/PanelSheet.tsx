"use client";

import { useState } from "react";
import type { KitPartId } from "@/lib/teamwear";
import { RightPanel } from "./RightPanel";
import type { useConfigurator } from "./useConfigurator";

/**
 * The right panel, with the one row the person has open. It is kept apart from the configurator so
 * opening a row does not redraw the stage, and so the panel's own state (which row is open) does not
 * travel in the undo stack: undo takes back a decision, not a disclosure.
 */

export type PanelSheetProps = Readonly<{
  title: string;
  state: ReturnType<typeof useConfigurator>;
  part: KitPartId;
  onPart: (part: KitPartId) => void;
}>;

export function PanelSheet({ title, state, part, onPart }: PanelSheetProps) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  return (
    <RightPanel
      title={title}
      parts={state.pills}
      part={part}
      onPart={(next) => {
        setOpenRow(null);
        onPart(next);
      }}
      rows={state.rows}
      openRow={openRow}
      onOpenRow={setOpenRow}
      colours={state.kit.colours}
      socksColour={state.kit.socksColour}
      bundleId={state.kit.bundleId}
      onBundle={state.chooseBundle}
      bundleProblem={state.bundleProblem}
      handlers={state.handlers}
    />
  );
}
