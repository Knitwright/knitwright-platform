import type { DockTool, RailId } from "@/lib/launch";

/**
 * One line drawing for each icon of the launch rail and the bottom tool dock, on a 20 by 20 grid,
 * drawn the same way the editor's tool icons are (`components/studio/workspace/ToolIcon.tsx`).
 */
const RAIL_PATHS: Readonly<Record<RailId, string>> = {
  templates: "M2.5 4 H17.5 V16 H2.5 Z M2.5 7.5 H17.5 M7.5 7.5 V16",
  text: "M4 4.5 H16 M10 4.5 V16 M7 16 H13",
  elements: "M10 2.5 L13 8 H7 Z M3.5 11 H8.5 V16 H3.5 Z M14 11 A2.6 2.6 0 1 0 14 16.2 A2.6 2.6 0 1 0 14 11",
  "ai-image": "M2.5 4.5 H17.5 V15.5 H2.5 Z M2.5 13 L7 8.5 L10.5 12 M13.5 4.5 L14.6 7 L17 8 L14.6 9 L13.5 11.5 L12.4 9 L10 8 L12.4 7 Z",
  mockups: "M7 3 L4 4.5 L2 8.5 L4.5 10 L5.5 8.5 V17 H14.5 V8.5 L15.5 10 L18 8.5 L16 4.5 L13 3 Q10 6 7 3 Z",
  photos: "M2.5 6 H6 L7.5 4 H12.5 L14 6 H17.5 V16 H2.5 Z M10 13.5 A2.75 2.75 0 1 0 10 8 A2.75 2.75 0 1 0 10 13.5",
  "pattern-fills": "M2.5 2.5 H17.5 V17.5 H2.5 Z M2.5 7.5 H17.5 M2.5 12.5 H17.5 M7.5 2.5 V17.5 M12.5 2.5 V17.5",
  likes: "M10 16.5 C5.5 13 3 10.8 3 8 A3.4 3.4 0 0 1 10 6 A3.4 3.4 0 0 1 17 8 C17 10.8 14.5 13 10 16.5 Z",
  uploads: "M10 14 V4 M6 7.5 L10 3.5 L14 7.5 M3.5 14 V16.5 H16.5 V14",
  brand: "M10 2.5 L16 5 V10 C16 13.5 13.5 16 10 17.5 C6.5 16 4 13.5 4 10 V5 Z M7.5 9.5 L9.5 11.5 L12.5 8",
  assistant: "M10 2.5 L11.6 7 L16 8.5 L11.6 10 L10 14.5 L8.4 10 L4 8.5 L8.4 7 Z M15 13.5 L15.7 15.3 L17.5 16 L15.7 16.7 L15 18.5 L14.3 16.7 L12.5 16 L14.3 15.3 Z",
  layers: "M10 2.5 L17.5 6.5 L10 10.5 L2.5 6.5 Z M2.5 10.5 L10 14.5 L17.5 10.5 M2.5 14 L10 18 L17.5 14",
};

const DOCK_PATHS: Readonly<Record<DockTool, string>> = {
  select: "M5 3 L15 10 L10.5 11 L13 16.5 L10.5 17.5 L8 12 L5 15 Z",
  frame: "M6 2.5 V17.5 M14 2.5 V17.5 M2.5 6 H17.5 M2.5 14 H17.5",
  shape: "M3 3 H11 V11 H3 Z M13 9 A4.5 4.5 0 1 0 13 18 A4.5 4.5 0 1 0 13 9",
  pen: "M3 17 L5 11 L13 3 L17 7 L9 15 Z M11 5 L15 9",
  text: "M4 5 H16 M10 5 V16 M7.5 16 H12.5",
  comment: "M3 4.5 H17 V13.5 H9.5 L5.5 17 V13.5 H3 Z M6.5 9 H13.5",
  ai: "M10 2.5 L11.8 7.2 L16.5 9 L11.8 10.8 L10 15.5 L8.2 10.8 L3.5 9 L8.2 7.2 Z",
};

const Drawing = ({ path, size }: Readonly<{ path: string; size: number }>) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RailIcon = ({ id, size = 18 }: Readonly<{ id: RailId; size?: number }>) => <Drawing path={RAIL_PATHS[id]} size={size} />;

export const DockIcon = ({ tool, size = 18 }: Readonly<{ tool: DockTool; size?: number }>) => <Drawing path={DOCK_PATHS[tool]} size={size} />;
