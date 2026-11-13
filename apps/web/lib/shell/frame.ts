/**
 * How wide the content under the top bar is (decision 0138).
 *
 * The v3.9 pages take the full width, with 10 §4's padding (0 40 px 60 px). The v2.2 pages were
 * laid out for the old 1110 px column and are kept in it until their wave-2 workstream rebuilds
 * them, so none of them stretches across a wide screen meanwhile. A workstream that rebuilds a page
 * adds its prefix here.
 */
export const FULL_WIDTH: readonly string[] = [
  "/ai-studio",
  "/mockups",
  "/marketing",
  "/orders",
  "/store",
  "/dev/orders",
  "/dev/pages",
  "/projects",
  "/dev/projects",
  "/dev/shell",
  "/dev/ai-studio",
  "/templates",
  "/team",
  "/brand",
  "/settings",
  "/dev/p6",
  "/products",
  "/dev/products",
  "/dev/store",
];

export type Frame = "full" | "column";

const inside = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

/** The frame of the page at this address. `/orders/runs` is a v2.2 page and keeps its column. */
export const frameFor = (path: string): Frame =>
  FULL_WIDTH.some((prefix) => inside(path, prefix)) && path !== "/orders/runs" ? "full" : "column";
