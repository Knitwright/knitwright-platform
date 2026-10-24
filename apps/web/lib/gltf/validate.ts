import { readAccessor } from "./accessors";
import { TEXTURE_SIZE, type LayoutPanel, type PanelLayout } from "./layout";
import type { GltfModel, GltfNode } from "./types";

/** Half a pixel of the 2048 picture. An artist's model must put each island's edges within this of the layout. */
export const DEFAULT_TOLERANCE_PX = 0.5;
/** The mesh of a panel is centred on its node origin to within this, so grading by node scale grows it about its middle. */
export const ORIGIN_TOLERANCE_MM = 1;
const OUTSIDE_PX = 0.5;

export interface PanelReport {
  readonly panelId: string;
  readonly found: boolean;
  /** The greatest distance, in pixels of the 2048 picture, between an edge of the model's island and the layout's. */
  readonly errorPx: number | null;
  /** How far the mesh's middle is from the node origin, in millimetres. */
  readonly originErrorMm: number | null;
  readonly ok: boolean;
  readonly reason: string | null;
}

export interface ModelReport {
  readonly ok: boolean;
  readonly panels: readonly PanelReport[];
  readonly issues: readonly string[];
}

export interface ValidateOptions {
  readonly tolerancePx?: number;
  /** The bytes of each buffer, when they are not in the file as data addresses. */
  readonly buffers?: readonly Uint8Array[];
}

const missing = (panelId: string): PanelReport => ({ panelId, found: false, errorPx: null, originErrorMm: null, ok: false, reason: `Panel ${panelId} has no node in the model.` });

function checkPanel(model: GltfModel, panel: LayoutPanel, node: GltfNode, tolerancePx: number, buffers?: readonly Uint8Array[]): PanelReport {
  const prims = model.meshes[node.mesh ?? -1]?.primitives ?? [];
  if (prims.length === 0) return { ...missing(panel.id), found: true, reason: `Panel ${panel.id} has no mesh.` };
  const uvs = prims.flatMap((p) => readAccessor(model, p.attributes.TEXCOORD_0, buffers).values);
  const xs = uvs.filter((_, i) => i % 2 === 0);
  const ys = uvs.filter((_, i) => i % 2 === 1);
  const { rect } = panel;
  const errorPx = Math.max(Math.abs(Math.min(...xs) - rect.u0), Math.abs(Math.max(...xs) - rect.u1), Math.abs(Math.min(...ys) - rect.v0), Math.abs(Math.max(...ys) - rect.v1)) * TEXTURE_SIZE;
  const outside = Math.max(0, -Math.min(...xs, ...ys), Math.max(...xs, ...ys) - 1) * TEXTURE_SIZE;
  const pos = prims.flatMap((p) => readAccessor(model, p.attributes.POSITION, buffers).values);
  const px = pos.filter((_, i) => i % 3 === 0);
  const py = pos.filter((_, i) => i % 3 === 1);
  const originErrorMm = Math.hypot((Math.min(...px) + Math.max(...px)) / 2, (Math.min(...py) + Math.max(...py)) / 2) * 1000;
  const reasons = [
    errorPx > tolerancePx ? `Panel ${panel.id}: the island is ${errorPx.toFixed(2)} px from the layout (allowed ${tolerancePx}).` : null,
    outside > OUTSIDE_PX ? `Panel ${panel.id}: texture coordinates lie outside the picture.` : null,
    originErrorMm > ORIGIN_TOLERANCE_MM ? `Panel ${panel.id}: the mesh is ${originErrorMm.toFixed(1)} mm from its node origin; centre it.` : null,
  ].filter((r): r is string => r !== null);
  return { panelId: panel.id, found: true, errorPx, originErrorMm, ok: reasons.length === 0, reason: reasons.join(" ") || null };
}

function materialIssues(model: GltfModel, layout: PanelLayout, nodes: ReadonlyMap<string, GltfNode>): string[] {
  const used = new Map<string, Set<number | undefined>>();
  for (const panel of layout.panels) {
    const node = nodes.get(panel.id);
    const set = used.get(panel.group) ?? new Set<number | undefined>();
    for (const p of model.meshes[node?.mesh ?? -1]?.primitives ?? []) set.add(p.material);
    used.set(panel.group, set);
  }
  const issues: string[] = [];
  const owner = new Map<number, string>();
  for (const [group, set] of used) {
    if (set.size > 1 || set.has(undefined)) issues.push(`The ${group} panels must share one material (found ${set.size}).`);
    for (const m of set) {
      if (m === undefined) continue;
      const taken = owner.get(m);
      if (taken && taken !== group) issues.push(`The ${taken} and ${group} panels share material ${m}; each panel group has its own material.`);
      owner.set(m, group);
    }
  }
  return issues;
}

/**
 * Proves the UV islands of a model equal the panel layout. This is the check an artist's model must pass: each panel has
 * a node named for it, its texture coordinates span exactly the layout's rectangle (within `tolerancePx`), its mesh is
 * centred on the node origin, each panel group has one material, and the model states a 2048 picture.
 */
export function validateModel(model: GltfModel, layout: PanelLayout, options: ValidateOptions = {}): ModelReport {
  const tolerancePx = options.tolerancePx ?? DEFAULT_TOLERANCE_PX;
  const issues: string[] = [];
  const nodes = new Map<string, GltfNode>();
  for (const node of model.nodes) if (node.name && !nodes.has(node.name)) nodes.set(node.name, node);
  const known = new Set(layout.panels.map((p) => p.id as string));
  for (const name of nodes.keys()) if (!known.has(name)) issues.push(`The node ${name} is not a panel of this layout.`);
  const size = model.asset.extras?.knitwright?.textureSize;
  if (size !== TEXTURE_SIZE) issues.push(`The model must state a texture size of ${TEXTURE_SIZE} (it states ${size ?? "none"}).`);
  const panels = layout.panels.map((panel) => {
    const node = nodes.get(panel.id);
    if (!node) return missing(panel.id);
    try {
      return checkPanel(model, panel, node, tolerancePx, options.buffers);
    } catch (error) {
      return { ...missing(panel.id), found: true, reason: error instanceof Error ? error.message : "The buffer cannot read." };
    }
  });
  issues.push(...panels.flatMap((p) => (p.reason ? [p.reason] : [])), ...materialIssues(model, layout, nodes));
  return { ok: issues.length === 0, panels, issues };
}
