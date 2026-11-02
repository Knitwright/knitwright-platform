import type { ComponentType } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import { BUILT_HERE, type BuiltHere } from "@/lib/launch-panels";
import BrandPanel from "./BrandPanel";
import TemplatesPanel from "./TemplatesPanel";
import UploadsPanel from "./UploadsPanel";

/**
 * THE THREE PANELS THIS DIRECTORY FILLS, as `components/launch/RailPanels.tsx` mounts them (L1's
 * contract, `lib/launch/panels.ts`; plan v5, decision 0108).
 *
 * The same arrangement as `components/marketing/panels.ts`: one map in the workstream's own file,
 * spread into the rail's `BUILT` map, so nothing is looked up by calling a function while the shell
 * renders (`react-hooks/static-components`, the rule the wave-4 wiring change ran into) and
 * so two workstreams adding panels in the same wave do not conflict on one registry.
 *
 * **`likes` is deliberately not here.** Nothing in the platform records a like -- the spec's own
 * data model puts a `likes` count on a template row rather than a record of who liked what, and no
 * migration has either -- so the panel keeps its labelled placeholder and the gap is an owner
 * question (`LIKES_GAP`). An empty grid with a heart on it would be a feature that looks real.
 */
export const LAUNCH_PANEL_COMPONENTS: Readonly<Record<BuiltHere, ComponentType<LaunchPanelProps>>> = {
  templates: TemplatesPanel,
  uploads: UploadsPanel,
  brand: BrandPanel,
};

/** The panel for an id this directory fills, or null for one it does not. */
export function launchPanel(id: string): ComponentType<LaunchPanelProps> | null {
  return (BUILT_HERE as readonly string[]).includes(id) ? LAUNCH_PANEL_COMPONENTS[id as BuiltHere] : null;
}
