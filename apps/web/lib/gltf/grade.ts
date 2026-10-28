import type { PanelLayout } from "./layout";
import type { GltfModel } from "./types";

interface GradeFactor {
  readonly panelId: string;
  readonly sx: number;
  readonly sy: number;
}

interface Graded {
  readonly model: GltfModel;
  readonly factors: readonly GradeFactor[];
  readonly issues: readonly string[];
}

/**
 * How much each panel grows or shrinks from the base size to a target size, from the two layouts' panel sizes in
 * millimetres. The block's own grading is whatever made those pieces; nothing here is a grade rule.
 */
export function gradeFactors(base: PanelLayout, target: PanelLayout): Pick<Graded, "factors" | "issues"> {
  const factors: GradeFactor[] = [];
  const issues: string[] = [];
  for (const panel of base.panels) {
    const other = target.panels.find((p) => p.id === panel.id);
    if (!other) issues.push(`Size ${target.size} has no ${panel.id} panel, so that panel stays at size ${base.size}.`);
    else factors.push({ panelId: panel.id, sx: other.widthMm / panel.widthMm, sy: other.heightMm / panel.heightMm });
  }
  return { factors, issues };
}

/**
 * The model for another size: each panel node is scaled in its own plane by the factor above (thickness is kept). The
 * UV islands do not move. The picture for that size is the panel render of that size, drawn into the same rectangles,
 * so the artwork is scaled with the panel and shows at its true size.
 */
export function gradeModel(model: GltfModel, base: PanelLayout, target: PanelLayout): Graded {
  const { factors, issues } = gradeFactors(base, target);
  const byPanel = new Map(factors.map((f) => [f.panelId, f]));
  return {
    model: {
      ...model,
      asset: { ...model.asset, extras: model.asset.extras && { knitwright: { ...model.asset.extras.knitwright, size: target.size } } },
      nodes: model.nodes.map((node) => {
        const factor = node.name ? byPanel.get(node.name) : undefined;
        return factor ? { ...node, scale: [factor.sx, factor.sy, 1] as const } : node;
      }),
    },
    factors,
    issues,
  };
}
