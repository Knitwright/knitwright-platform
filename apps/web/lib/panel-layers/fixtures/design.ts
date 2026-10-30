import { jersey } from "@/lib/editor/fixtures/article";
import type { EditorCommands, EditorDesign, EditorSlotProps } from "@/lib/editor/slots";
import { applyAction, type GarmentSpec, type SpecAction } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";

/** TEST FIXTURE ONLY. A design as the shell hands it to a slot panel (the slot contract, `lib/editor/slots.ts`). */

const applied = (spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec =>
  actions.reduce((current, action) => {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(result.reason);
    return result.spec;
  }, spec);

export function design(over: Partial<EditorDesign> = {}, actions: readonly SpecAction[] = []): EditorDesign {
  const spec = applied(start("team-jersey"), actions);
  return {
    projectId: "9f1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
    version: 1,
    spec,
    article: jersey(),
    form: { options: {}, parameters: {} },
    size: "M",
    sizes: ["XS", "S", "M", "L", "XL"],
    colourwayId: spec.colourways[0].id,
    draft: null,
    busy: false,
    ...over,
  };
}

/** Commands that only record what a panel asked for, so a test can read the calls back. */
export function recorder(): { commands: EditorCommands; calls: string[] } {
  const calls: string[] = [];
  const note = (what: string) => calls.push(what);
  return {
    calls,
    commands: {
      setOption: (group, code) => note(`setOption ${group} ${code}`),
      setParameter: (key, mm) => note(`setParameter ${key} ${mm}`),
      setSize: (size) => note(`setSize ${size}`),
      setColourway: (id) => note(`setColourway ${id}`),
      showView: (view, beside) => note(`showView ${view} ${beside === true}`),
      openRail: (segment) => note(`openRail ${segment}`),
      openSummary: (section) => note(`openSummary ${section}`),
      save: (key, action) => note(`save ${key} ${action.type}`),
      needsSimulation: () => note("needsSimulation"),
    },
  };
}

export const slotProps = (over: Partial<EditorDesign> = {}): EditorSlotProps => ({ design: design(over), commands: recorder().commands });
