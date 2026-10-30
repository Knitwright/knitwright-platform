import { toolHref, type ToolId } from "@/lib/workspace/tools";

/**
 * The File menu of the top bar (spec F-S4). Every item is somewhere that already exists: a panel
 * of this shell, or a page of the design. Nothing is listed that does nothing, and nothing new is
 * invented for the menu.
 */

export type FileMenuItem =
  /** Opens a panel of the shell in place. The link is real, so it also opens in a new tab. */
  | Readonly<{ kind: "tool"; id: string; label: string; tool: ToolId; href: string }>
  /** Goes to a page of its own. */
  | Readonly<{ kind: "page"; id: string; label: string; href: string }>;

const designPage = (projectId: string): string => `/studio/${encodeURIComponent(projectId)}`;

/** The menu for one design, in the order a person reaches for it. */
export function fileMenu(projectId: string): readonly FileMenuItem[] {
  const tool = (id: string, label: string, name: ToolId): FileMenuItem => ({ kind: "tool", id, label, tool: name, href: toolHref(projectId, name) });
  return [
    tool("details", "Design details", "garment"),
    tool("history", "Version history", "history"),
    tool("share", "Share…", "share"),
    { kind: "page", id: "tech-pack", label: "Factory file", href: `${designPage(projectId)}/tech-pack` },
    // Plan v5 Y7: the make pages (sample, golden sample, run). One navigation entry, added by that workstream.
    { kind: "page", id: "make", label: "Make and order", href: `${designPage(projectId)}/make` },
    { kind: "page", id: "delete", label: "Move to trash…", href: `${designPage(projectId)}/delete` },
  ];
}
