/**
 * A DXF file is pairs of lines: a group code, then a value. This reads the pairs into
 * sections, blocks and entities, and nothing more. What the entities mean is in read.ts.
 */

export type DxfEntity = Readonly<{
  type: string;
  layer: string;
  /** Every group code and value of the entity, in file order, except its type. */
  pairs: readonly (readonly [number, string])[];
  /** The vertices that follow a POLYLINE, as [x, y]. */
  vertices: readonly (readonly [number, number])[];
}>;

export type DxfBlock = Readonly<{ name: string; entities: readonly DxfEntity[] }>;

export type DxfDocument = Readonly<{
  /** Header variables such as $INSUNITS, as the text the file gives. */
  header: Readonly<Record<string, string>>;
  blocks: readonly DxfBlock[];
  entities: readonly DxfEntity[];
}>;

export class DxfSyntaxError extends Error {}

export const MAX_DXF_BYTES = 8 * 1024 * 1024;

type Pair = readonly [number, string];

function toPairs(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code) || code < 0 || code > 1071) {
      throw new DxfSyntaxError(`Line ${i + 1} should hold a group code, and holds "${lines[i].trim().slice(0, 20)}".`);
    }
    pairs.push([code, lines[i + 1].trim()]);
  }
  return pairs;
}

type Group = { type: string; pairs: Pair[] };

/** Splits a run of pairs at each code 0, which starts a new group. */
function groupsOf(pairs: readonly Pair[]): Group[] {
  const groups: Group[] = [];
  for (const pair of pairs) {
    if (pair[0] === 0) groups.push({ type: pair[1], pairs: [] });
    else groups.at(-1)?.pairs.push(pair);
  }
  return groups;
}

const layerOf = (list: readonly Pair[]): string => list.find((p) => p[0] === 8)?.[1] ?? "0";

const vertexNumber = (list: readonly Pair[], code: number): number => {
  const value = Number(list.find((p) => p[0] === code)?.[1]);
  if (!Number.isFinite(value)) throw new DxfSyntaxError("A vertex in the file has no usable position.");
  return value;
};

/** Entities in a list of groups, with each VERTEX folded into the POLYLINE before it. */
function entitiesOf(groups: readonly Group[]): DxfEntity[] {
  const entities: DxfEntity[] = [];
  let open: { layer: string; pairs: Pair[]; vertices: [number, number][] } | null = null;
  for (const group of groups) {
    if (open && group.type !== "VERTEX" && group.type !== "SEQEND") {
      // A polyline whose SEQEND is missing ends where the next thing starts.
      entities.push({ type: "POLYLINE", ...open });
      open = null;
    }
    if (group.type === "POLYLINE") {
      open = { layer: layerOf(group.pairs), pairs: group.pairs, vertices: [] };
    } else if (group.type === "VERTEX" && open) {
      open.vertices.push([vertexNumber(group.pairs, 10), vertexNumber(group.pairs, 20)]);
    } else if (group.type === "SEQEND" && open) {
      entities.push({ type: "POLYLINE", ...open });
      open = null;
    } else if (!["SECTION", "ENDSEC", "EOF", "ENDBLK"].includes(group.type)) {
      entities.push({ type: group.type, layer: layerOf(group.pairs), pairs: group.pairs, vertices: [] });
    }
  }
  if (open) entities.push({ type: "POLYLINE", ...open });
  return entities;
}

function headerOf(body: readonly Pair[]): Record<string, string> {
  const header: Record<string, string> = {};
  let variable = "";
  for (const [code, value] of body) {
    if (code === 9) variable = value;
    else if (variable && !(variable in header)) header[variable] = value;
  }
  return header;
}

function blocksOf(body: readonly Pair[]): DxfBlock[] {
  const blocks: DxfBlock[] = [];
  let current: { name: string; groups: Group[] } | null = null;
  for (const group of groupsOf(body)) {
    if (group.type === "BLOCK") current = { name: group.pairs.find((p) => p[0] === 2)?.[1] ?? "", groups: [] };
    else if (group.type === "ENDBLK" && current) {
      blocks.push({ name: current.name, entities: entitiesOf(current.groups) });
      current = null;
    } else current?.groups.push(group);
  }
  return blocks;
}

/** Splits the file at its SECTION markers. */
export function parseDxf(text: string): DxfDocument {
  if (text.length > MAX_DXF_BYTES) throw new DxfSyntaxError("The file is too large to read.");
  const pairs = toPairs(text);
  if (!pairs.some((p) => p[0] === 0 && p[1] === "SECTION")) throw new DxfSyntaxError("This does not look like a DXF file.");
  let header: Record<string, string> = {};
  let blocks: DxfBlock[] = [];
  let entities: DxfEntity[] = [];
  let section = "";
  let start = 0;
  pairs.forEach((p, i) => {
    if (p[0] === 0 && p[1] === "SECTION") {
      section = pairs[i + 1]?.[1] ?? "";
      start = i + 2;
    } else if (p[0] === 0 && p[1] === "ENDSEC") {
      const body = pairs.slice(start, i);
      if (section === "HEADER") header = headerOf(body);
      else if (section === "BLOCKS") blocks = blocksOf(body);
      else if (section === "ENTITIES") entities = entitiesOf(groupsOf(body));
      section = "";
    }
  });
  return { header, blocks, entities };
}
