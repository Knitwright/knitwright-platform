import type { ToolId } from "@/lib/workspace/tools";

/** One line drawing for each tool, on a 20 by 20 grid. */
const PATHS: Readonly<Record<ToolId, string>> = {
  garment: "M7 3 L4 4.5 L1.5 9 L4 10.5 L5 9 V17 H15 V9 L16 10.5 L18.5 9 L16 4.5 L13 3 Q10 6 7 3 Z",
  colours: "M10 2.5 A7.5 7.5 0 1 0 10 17.5 C11.5 17.5 11.5 15.5 10.5 14.5 C9.5 13.5 10.5 12 12 12 H14.5 A3 3 0 0 0 17.5 9 A7 6.5 0 0 0 10 2.5 Z M6 9 h.01 M8.5 6 h.01 M12.5 6 h.01",
  sizes: "M2.5 7 H17.5 V13 H2.5 Z M5.5 7 V9.5 M8.5 7 V10.5 M11.5 7 V9.5 M14.5 7 V10.5",
  fabric: "M3 5 Q6.5 2.5 10 5 T17 5 V15 Q13.5 17.5 10 15 T3 15 Z M3 10 Q6.5 7.5 10 10 T17 10",
  logos: "M10 2.5 L16 5 V10 C16 13.5 13.5 16 10 17.5 C6.5 16 4 13.5 4 10 V5 Z M7.5 10 L9.5 12 L12.5 8.5",
  names: "M4 4.5 H16 M10 4.5 V16 M5.5 16 L7 11.5 M14.5 16 L13 11.5",
  labels: "M3 3 H11 L17 9 L11 17 L3 9 Z M6.5 6.5 h.01",
  variants: "M3 3 H8.5 V8.5 H3 Z M11.5 3 H17 V8.5 H11.5 Z M3 11.5 H8.5 V17 H3 Z M11.5 11.5 H17 V17 H11.5 Z",
  history: "M3.5 10 A6.5 6.5 0 1 0 5.5 5.3 M3.5 3 V6 H6.5 M10 6.5 V10 L12.5 11.5",
  share: "M6.5 10 L13.5 6 M6.5 10 L13.5 14 M15 5.5 A2 2 0 1 1 15 5.49 M15 14.5 A2 2 0 1 1 15 14.49 M5 10 A2 2 0 1 1 5 9.99",
  photoreal: "M2.5 6 H6 L7.5 4 H12.5 L14 6 H17.5 V16 H2.5 Z M10 13.5 A2.75 2.75 0 1 0 10 8 A2.75 2.75 0 1 0 10 13.5",
  production: "M3 15 L9 4.5 L12 9.5 L14 6.5 L17 15 Z M3 17.5 H17",
  quote: "M5 2.5 H12 L15.5 6 V17.5 H5 Z M8 9.5 H12.5 M8 12.5 H12.5",
};

export function ToolIcon({ tool, size = 20 }: Readonly<{ tool: ToolId; size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={PATHS[tool]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
