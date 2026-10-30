/** TEST SUPPORT ONLY. What the editor shell's slot contract hands these two panels. */
import { jersey } from "@/lib/editor/fixtures/article";
import type { EditorCommands, EditorDesign, EditorSlotProps } from "@/lib/editor";
import { fullDesign } from "@/lib/techpack/fixtures/designs";

export const calls: { showView: string[]; save: string[] } = { showView: [], save: [] };

export const commands = (): EditorCommands => ({
  setOption: () => undefined,
  setParameter: () => undefined,
  setSize: () => undefined,
  setColourway: () => undefined,
  showView: (view, beside) => calls.showView.push(`${view}${beside === true ? " beside" : ""}`),
  openRail: () => undefined,
  openSummary: () => undefined,
  save: (key) => calls.save.push(key),
  needsSimulation: () => undefined,
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
