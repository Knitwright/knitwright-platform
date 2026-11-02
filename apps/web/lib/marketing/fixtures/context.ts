import type { ArtboardPreset, BoardView, LaunchContext, LaunchProjectView } from "@/lib/launch";
import { board, project } from "@/lib/launch/fixtures/canvas";
import { asSettings, withTemplate, EMPTY_SETTINGS } from "../board";
import { buildMarketingTemplates } from "../templates/build";

/** Contexts for this directory's tests. Nothing here reaches the database or the shell. */

export const PRESETS: readonly ArtboardPreset[] = [
  { key: "social-post-4-5", label: "Social post 4:5", width: 1080, height: 1350, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: "Placeholder size, not reviewed by anyone" },
  { key: "a4-print", label: "A4 print", width: 210, height: 297, unit: "mm", dpi: 300, ruleId: "R-GAP-000", note: "ISO 216 A4; the resolution is a placeholder" },
];

/** A marketing board on the layout whose key is given, or on none. */
export function marketingBoard(id = "board-1", layoutKey: string | null = "new-kit-reveal"): BoardView {
  const template = buildMarketingTemplates().find((one) => one.layoutKey === layoutKey);
  const settings = template ? withTemplate(EMPTY_SETTINGS, template) : EMPTY_SETTINGS;
  return board(id, "marketing", { name: "New kit post", settings: asSettings(settings) });
}

/** A context with one board selected, or nothing selected. */
export function context(selected: BoardView | null, boards: readonly BoardView[] = selected ? [selected] : [], extra: Partial<LaunchContext> = {}): LaunchContext {
  const view: LaunchProjectView = project(boards);
  return {
    project: view,
    selection: selected ? { board: selected, image: false } : null,
    credits: 40,
    presets: PRESETS,
    unit: "px",
    zoom: 100,
    dockTool: "select",
    busy: false,
    ...extra,
  };
}
