import type { Route } from "next";

/**
 * The top-bar tabs of the areas U2 put in place (decision 0138). Each area's workstream takes its
 * list over when it builds the pages (P3 AI Studio, P5 Orders).
 */
export interface AreaTab {
  readonly href: Route;
  readonly label: string;
  readonly owns?: readonly string[];
}

/** AI Studio opens on AI Workflows (09 screen 2, v3.2), then Kittl's other three tabs. */
export const AI_STUDIO_TABS: readonly AreaTab[] = [
  { href: "/ai-studio", label: "AI Workflows", owns: ["/ai-studio/workflows", "/ai-studio/workflow"] },
  { href: "/ai-studio/agent", label: "Creative Agent" },
  { href: "/ai-studio/image", label: "Image Generator" },
  { href: "/ai-studio/video", label: "Video Generator" },
];

/** Orders, and the product runs that moved here from `/brand`. */
export const ORDERS_TABS: readonly AreaTab[] = [
  { href: "/orders", label: "Orders" },
  { href: "/orders/runs", label: "Product runs" },
];
