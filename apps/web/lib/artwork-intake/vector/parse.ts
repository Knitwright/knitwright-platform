import { AppError } from "@/lib/server/core/errors";
import { REFUSALS } from "../messages";
import { INTAKE_LIMITS } from "../settings";
import { convertElement, WARNINGS, type Context } from "./convert";
import { vectorModelSchema, VECTOR_MODEL_VERSION, type VectorModel } from "./model";
import { IdMap, ROOT_STYLE } from "./paint";
import { refuse } from "./refusal";
import { collectIds, scanTree } from "./security";
import { parseStyleSheet, type Rule } from "./style";
import { readXml, type XmlElement } from "./xml";

type Embed = Context["embed"];

export type ParsedSvg = Readonly<{ model: VectorModel; warnings: readonly string[] }>;

const MM_PER_UNIT: Readonly<Record<string, number>> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6 };

/** A size the file states in a real unit, in mm, or null (pixels, nothing, or a percentage are not a measurement). */
const sizeMm = (value: string | undefined): number | null => {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(mm|cm|in|pt|pc)\s*$/i.exec(value ?? "");
  return match ? Number.parseFloat(match[1]) * MM_PER_UNIT[match[2].toLowerCase()] : null;
};

const pixels = (value: string | undefined): number | null => {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(px)?\s*$/.exec(value ?? "");
  return match ? Number.parseFloat(match[1]) : null;
};

const boxOf = (root: XmlElement): VectorModel["viewBox"] => {
  const parts = (root.attrs.get("viewBox") ?? "").split(/[\s,]+/).filter((part) => part !== "").map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }
  const width = pixels(root.attrs.get("width"));
  const height = pixels(root.attrs.get("height"));
  if (width === null || height === null || width <= 0 || height <= 0) throw new AppError("invalid_input", REFUSALS.svgEmpty);
  return { x: 0, y: 0, width, height };
};

const statedSize = (root: XmlElement): VectorModel["statedSizeMm"] => {
  const width = sizeMm(root.attrs.get("width"));
  const height = sizeMm(root.attrs.get("height"));
  return width !== null && height !== null && width > 0 && height > 0 ? { width, height } : null;
};

const sheetsOf = (root: XmlElement, warnings: Set<string>): Rule[] => {
  const rules: Rule[] = [];
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const element = stack.pop() as XmlElement;
    if (element.name === "style" && element.prefix === "") {
      const sheet = parseStyleSheet(element.text);
      rules.push(...sheet.rules);
      if (sheet.skipped > 0) warnings.add(WARNINGS.sheet);
    }
    stack.push(...[...element.children].reverse());
  }
  return rules;
};

const decode = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return refuse("malformed");
  }
};

/**
 * Reads an SVG into the restricted vector model, or refuses it with the reason. The file is read only as
 * text; nothing in it runs or loads; and what comes out is plain data. The original is not kept.
 */
export async function parseSvg(bytes: Uint8Array, embed: Embed): Promise<ParsedSvg> {
  if (bytes.byteLength > INTAKE_LIMITS.maxVectorFileBytes) return refuse("tooComplex");
  const root = readXml(decode(bytes));
  if (root.name !== "svg" || root.prefix !== "") throw new AppError("invalid_input", REFUSALS.svgNotSvg);
  scanTree(root);
  const warnings = new Set<string>();
  const context: Context = {
    ids: collectIds(root),
    rules: sheetsOf(root, warnings),
    warnings,
    gradientIds: new IdMap("g"),
    clipIds: new IdMap("c"),
    gradients: [],
    clips: [],
    embed,
    counts: { nodes: 0, uses: 0, images: 0, commands: { commands: 0 } },
  };
  const nodes = await convertElement(root, ROOT_STYLE, context, { depth: 0, uses: [] });
  if (nodes.length === 0) throw new AppError("invalid_input", REFUSALS.svgEmpty);
  const candidate = {
    schemaVersion: VECTOR_MODEL_VERSION,
    viewBox: boxOf(root),
    statedSizeMm: statedSize(root),
    gradients: context.gradients,
    clips: context.clips,
    nodes,
  };
  const model = vectorModelSchema.safeParse(candidate);
  if (!model.success) return refuse("malformed");
  return { model: model.data, warnings: [...warnings].sort() };
}
