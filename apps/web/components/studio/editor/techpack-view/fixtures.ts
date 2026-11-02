/** TEST SUPPORT ONLY. What the editor shell's slot contract hands these two panels. */
import { jersey } from "@/lib/editor/fixtures/article";
import type { EditorCommands, EditorDesign, EditorSlotProps } from "@/lib/editor";
import { applyAction, type GarmentSpec, type MeasureTool, type SpecAction } from "@/lib/garment";
import { fullDesign } from "@/lib/techpack/fixtures/designs";

export const calls: { showView: string[]; save: { key: string; action: SpecAction }[] } = { showView: [], save: [] };

/** Forgets what the last panel asked for, so one test cannot see another's calls. */
export const resetCalls = (): void => {
  calls.showView.length = 0;
  calls.save.length = 0;
};

export const commands = (): EditorCommands => ({
  setOption: () => undefined,
  setParameter: () => undefined,
  setSize: () => undefined,
  setColourway: () => undefined,
  showView: (view, beside) => calls.showView.push(`${view}${beside === true ? " beside" : ""}`),
  openRail: () => undefined,
  openSummary: () => undefined,
  save: (key, action) => calls.save.push({ key, action }),
  needsSimulation: () => undefined,
});

/** A design with these changes applied, so a test can start from a design that has marks on it. */
export function designWith(spec: GarmentSpec, actions: readonly SpecAction[]): GarmentSpec {
  let current = spec;
  for (const action of actions) {
    const result = applyAction(current, action);
    if (!result.ok) throw new Error(`The fixture was refused: ${result.reason}`);
    current = result.spec;
  }
  return current;
}

/** A point of measure the Specs toolbar drew, for a test that needs one on the design. */
export const drawnPom = (
  overrides: Partial<Readonly<{ id: string; label: string; lengthMm: number | null; tool: MeasureTool }>> = {},
): SpecAction => {
  const pom = { id: "m1", label: "Pocket opening", lengthMm: 120 as number | null, tool: "measure-line" as MeasureTool, ...overrides };
  return {
    type: "set-extra-pom",
    pom: { ...pom, note: null, points: [{ panelId: "body-front", xMm: 10, yMm: 20 }], drawnOn: "2d", provenance: "user-edited" },
  };
};

/** A callout the Specs toolbar drew. */
export const drawnCallout = (id = "c1", label = "Hem finish", note: string | null = "Twin needle, 6 mm"): SpecAction => ({
  type: "set-callout",
  callout: { id, label, note, points: [{ panelId: "body-front", xMm: 30, yMm: 40 }], drawnOn: "2d", provenance: "user-edited" },
});

export function slotProps(patch: Partial<EditorDesign> = {}): EditorSlotProps {
  const spec = fullDesign("team-jersey");
  const article = jersey();
  const design: EditorDesign = {
    projectId: "11111111-1111-4111-8111-111111111111",
    version: 3,
    spec,
    article,
    form: { options: {}, parameters: {} },
    size: article.sampleSize ?? "M",
    sizes: article.sizeRange,
    colourwayId: spec.colourways[0].id,
    draft: null,
    busy: false,
    ...patch,
  };
  return { design, commands: commands() };
}
