/**
 * The keyboard rules of the shell's menus (decision 0138), apart from React so they are tested
 * alone. They follow the WAI-ARIA menu button pattern, as U1's `Menu` does (decision 0137):
 *
 * - on the trigger, Enter, Space and ↓ open the menu on its first item, ↑ on its last;
 * - inside, the arrows, Home and End move and wrap (U1's `moveIndex`);
 * - Esc closes and gives the trigger its focus back; Tab closes and lets focus move on.
 */

export type OpenAt = "first" | "last";

/** Where a key pressed on the trigger opens the menu, or null when it does not open it. */
export const openAtFor = (key: string): OpenAt | null => {
  if (key === "ArrowDown" || key === "Enter" || key === " ") return "first";
  if (key === "ArrowUp") return "last";
  return null;
};

/** What a key pressed inside the open menu does to the menu itself. Moves are U1's `moveIndex`. */
export const closeFor = (key: string): "refocus" | "release" | null => {
  if (key === "Escape") return "refocus";
  if (key === "Tab") return "release";
  return null;
};

/** The index the menu opens on, for `count` items. */
export const startIndex = (at: OpenAt, count: number): number | null => {
  if (count <= 0) return null;
  return at === "first" ? 0 : count - 1;
};
