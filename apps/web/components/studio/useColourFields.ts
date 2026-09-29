"use client";

import { useEffect, useState } from "react";
import type { ColourRow } from "@/lib/projects/colour-controls";
import { colourKey } from "./keys";

/**
 * The text the person is typing for one part: its colour code and its drawn colour as
 * #rrggbb. The server's values replace them when the design changes underneath, and the
 * page is told while they hold text that was not saved.
 */
export function useColourFields(row: ColourRow, onDirty: (key: string, dirty: boolean) => void) {
  const key = colourKey(row.panelId);
  const serverHex = row.hasSwatch ? row.swatch : "";
  const [text, setText] = useState(row.colourText);
  const [hex, setHex] = useState(serverHex);
  const [seen, setSeen] = useState(`${row.colourText}|${serverHex}`);
  if (seen !== `${row.colourText}|${serverHex}`) {
    setSeen(`${row.colourText}|${serverHex}`);
    setText(row.colourText);
    setHex(serverHex);
  }
  const dirty = text.trim() !== row.colourText || hex.trim() !== serverHex;
  useEffect(() => onDirty(key, dirty), [key, dirty, onDirty]);
  useEffect(() => () => onDirty(key, false), [key, onDirty]);
  return { key, text, setText, hex, setHex, serverText: row.colourText, serverHex };
}
