import { PRODUCT } from "@/lib/config/product";
import { external, later, newDesign, page, type Target } from "./targets";

/**
 * The studio's left sidebar (spec F-S4, "Studio home"): + New, the workspace switcher, Products,
 * Brand kit, Projects (All · Designs · Collections · Moodboards · Pattern fills · Mockups · Flows),
 * Library, Help and Trash.
 *
 * Only the entries with a page behind them today carry one. Everything the platform has not built
 * yet carries `later`, so the sidebar shows "Coming in a later release" rather than a dead link.
 */

export interface SidebarItem {
  readonly id: string;
  readonly label: string;
  readonly target: Target;
  /** One short line under the label, where the label alone does not say what the entry is. */
  readonly hint?: string;
}

export interface SidebarGroup {
  readonly id: string;
  /** Null for the group at the top, which has no heading of its own. */
  readonly label: string | null;
  readonly items: readonly SidebarItem[];
}

export const SIDEBAR: readonly SidebarGroup[] = [
  {
    id: "start",
    label: null,
    items: [
      { id: "new", label: "+ New", target: newDesign, hint: "Start a design" },
      { id: "workspace", label: "Workspace", target: page("/brands"), hint: "Switch workspace" },
    ],
  },
  {
    id: "yours",
    label: "Yours",
    items: [
      { id: "products", label: "Products", target: page("/studio"), hint: "Your designs" },
      { id: "brand-kit", label: "Brand kit", target: page("/brand") },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    items: [
      { id: "all", label: "All", target: page("/studio") },
      { id: "designs", label: "Designs", target: page("/studio?jump=designs") },
      { id: "collections", label: "Collections", target: later },
      { id: "moodboards", label: "Moodboards", target: later },
      { id: "pattern-fills", label: "Pattern fills", target: later },
      { id: "mockups", label: "Mockups", target: later },
      { id: "flows", label: "Flows", target: later },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "base-products", label: "Base products", target: page("/catalogue") },
      { id: "templates", label: "Templates", target: page("/catalogue?tab=templates") },
      { id: "fabrics", label: "Fabrics", target: page("/brands/fabrics") },
      { id: "size-charts", label: "Size charts", target: page("/studio/charts") },
    ],
  },
  {
    id: "bottom",
    label: "Help and Trash",
    items: [
      { id: "help", label: "Help", target: external(`mailto:${PRODUCT.contactEmail}`), hint: "Email the team" },
      { id: "trash", label: "Trash", target: later },
    ],
  },
];

/** Every item of the sidebar, in the order it is drawn. */
export const sidebarItems = (): readonly SidebarItem[] => SIDEBAR.flatMap((group) => group.items);

/** The item with this id, or undefined when the sidebar has no such entry. */
export const sidebarItem = (id: string): SidebarItem | undefined => sidebarItems().find((item) => item.id === id);
